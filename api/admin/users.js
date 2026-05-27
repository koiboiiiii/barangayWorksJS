const { URL } = require('url');

module.exports = async (req, res) => {
  try {
    const backendBase = process.env.NEXT_PUBLIC_API_URL;
    if (!backendBase) {
      res.status(500).json({ ok: false, error: 'NEXT_PUBLIC_API_URL not configured' });
      return;
    }

    // Build target URL by combining backendBase with the request path
    const target = new URL('/api/admin/users' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''), backendBase).toString();

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const fetchRes = await fetch(target, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const text = await fetchRes.text();
    const contentType = fetchRes.headers.get('content-type') || 'application/json';
    res.status(fetchRes.status);
    res.setHeader('Content-Type', contentType);
    // Allow requests from the Vercel frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error) });
  }
};
