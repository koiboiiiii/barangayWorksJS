const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  registerAdminRoutes,
  ensureSupervisorAutonomy,
  closePool,
} = require('./controller/controller');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors({
  origin(origin, callback) {
    // Allow requests from file:// (no origin) and local frontends.
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'barangayworks-api' });
});

registerAdminRoutes(app);

const server = app.listen(PORT, async () => {
  try {
    await ensureSupervisorAutonomy();
    console.log(`[api] running on http://localhost:${PORT}`);
  } catch (error) {
    console.error('[api] startup seed failed:', error.message);
  }
});

async function shutdown() {
  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error('[api] pool close error:', error.message);
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
