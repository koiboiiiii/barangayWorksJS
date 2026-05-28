const { URL } = require('url');

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
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'DELETE') {
      res.setHeader('Allow', 'DELETE, OPTIONS');
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const processId = req.query.id;
    const target = new URL(`/api/processes/${encodeURIComponent(processId)}`, backendBase).toString();
    const fetchRes = await fetch(target, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
      },
      redirect: 'manual',
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