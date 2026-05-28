const { URL } = require('url');

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT, OPTIONS');
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const target = new URL('/api/schedules', backendBase).toString();
    const headers = {
      accept: 'application/json',
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    let body;
    if (req.method === 'PUT') {
      const buf = await readBody(req);
      if (buf && buf.length) body = buf;
    }

    const fetchRes = await fetch(target, {
      method: req.method,
      headers,
      body,
    });

    const text = await fetchRes.text();
    res.status(fetchRes.status);
    const ct = fetchRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(text);
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error) });
  }
};