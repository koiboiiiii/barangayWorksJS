const { URL } = require('url');

module.exports = async (req, res) => {
  try {
    const backendBase = process.env.NEXT_PUBLIC_API_URL;
    if (!backendBase) return res.status(500).json({ ok: false, error: 'NEXT_PUBLIC_API_URL not configured' });

    const origin = req.headers.origin || '*';
    if (origin && origin !== '*') res.setHeader('Access-Control-Allow-Origin', origin); else res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    const username = req.query.username;
    const target = new URL(`/api/admin/user/${encodeURIComponent(username)}/role`, backendBase).toString();

    const fetchRes = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json', cookie: req.headers.cookie || '' },
      body: req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT' ? await (async ()=>{const chunks=[]; for await (const c of req) chunks.push(c); return Buffer.concat(chunks);} )() : undefined
    });

    const text = await fetchRes.text();
    res.status(fetchRes.status);
    const ct = fetchRes.headers.get('content-type'); if (ct) res.setHeader('Content-Type', ct);
    res.send(text);
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) });
  }
};