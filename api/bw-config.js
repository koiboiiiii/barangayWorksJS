module.exports = function (req, res) {
  // On Vercel prefer the page origin (same-origin) so the frontend will call
  // the serverless proxy. For local/dev (non-Vercel) prefer NEXT_PUBLIC_API_URL
  // if provided so developers can point to a separate backend.
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const runningOnVercel = !!process.env.VERCEL;

  let url = envUrl;
  if (runningOnVercel) {
    // Force same-origin inference when deployed to Vercel.
    url = '';
  }

  if (!url) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    url = proto + '://' + host;
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // Disable caching so clients pick up runtime config changes immediately.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send("window.BW_API_BASE = '" + url + "';");
};
