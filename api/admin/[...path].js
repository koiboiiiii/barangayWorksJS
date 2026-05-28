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

    // Use the incoming request URL as the backend path (preserve /api/admin prefix)
    // so the backend receives the same route structure.
    const backendPath = req.url || '';
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

    // Copy all headers from backend response, including Set-Cookie, Content-Disposition, etc.
    const rawHeaders = fetchRes.headers.raw();
    for (const headerName of Object.keys(rawHeaders)) {
      if (headerName.toLowerCase() === 'transfer-encoding') continue;
      if (headerName.toLowerCase() === 'connection') continue;
      if (headerName.toLowerCase() === 'keep-alive') continue;
      if (headerName.toLowerCase() === 'content-length') continue;
      if (headerName.toLowerCase() === 'access-control-expose-headers') continue;

      const headerValue = rawHeaders[headerName];
      if (Array.isArray(headerValue)) {
        res.setHeader(headerName, headerValue);
      } else if (headerValue !== undefined) {
        res.setHeader(headerName, headerValue);
      }
    }

    // Ensure the browser can see cookies set by the backend through the proxy.
    const setCookie = rawHeaders['set-cookie'];
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    const bodyBuffer = Buffer.from(await fetchRes.arrayBuffer());
    res.send(bodyBuffer);
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) });
  }
};
