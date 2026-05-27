const { URL } = require('url');

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    const backendBase = process.env.NEXT_PUBLIC_API_URL;
    if (!backendBase) {
      res.status(500).json({ ok: false, error: 'NEXT_PUBLIC_API_URL not configured' });
      return;
    }

    const origin = req.headers.origin || '*';
    if (origin && origin !== '*') {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // path param arrives as req.query.path in Vercel preview environment, but
    // the raw URL contains the full path. We'll derive the backend path by
    // taking req.url after '/api/admin'.
    let backendPath = req.url || '';
    // Strip any leading '/api/admin' prefix if present
    backendPath = backendPath.replace(/^\/api\/admin/, '') || '/';

    const target = new URL(backendPath, backendBase).toString();

    const headers = {};
    // Forward most headers except host
    for (const h of Object.keys(req.headers || {})) {
      if (h.toLowerCase() === 'host') continue;
      headers[h] = req.headers[h];
    }

    // If the client sent a cookie for this domain, forward it to backend
    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const buf = await readBody(req);
      if (buf && buf.length) body = buf;
    }

    const fetchRes = await fetch(target, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual'
    });

    // Relay status and headers
    res.status(fetchRes.status);
    const ct = fetchRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    const text = await fetchRes.text();
    res.send(text);
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) });
  }
};
