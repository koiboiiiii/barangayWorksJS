module.exports = function (req, res) {
  // Prefer an explicit environment URL (NEXT_PUBLIC_API_URL). If not set,
  // infer the origin from forwarded headers so the frontend can use same-origin
  // requests when possible.
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  let url = envUrl;
  if (!url) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    url = proto + '://' + host;
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // Allow caching for a short time; callers can always bypass cache by adding a timestamp.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send("window.BW_API_BASE = '" + url + "';");
};
