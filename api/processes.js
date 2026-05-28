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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const path = req.url || '/api/processes';
    const target = new URL(path, backendBase).toString();
    const headers = {};

    for (const headerName of Object.keys(req.headers || {})) {
      if (headerName.toLowerCase() === 'host') continue;
      headers[headerName] = req.headers[headerName];
    }

    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    let body;
    if (req.method === 'POST' || req.method === 'DELETE') {
      const buf = await readBody(req);
      if (buf && buf.length) body = buf;
    }

    const fetchRes = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    const text = await fetchRes.text();
    res.status(fetchRes.status);
    const contentType = fetchRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.send(text);
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error) });
  }
};