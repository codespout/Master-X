import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, UPLOAD_DIR, CLIENT_DIR, NODE_ENV } from './config.js';
import { initDb } from './db.js';
import { notFound, errorHandler } from './middleware.js';
import { startPriceEngine, getPrices } from './priceEngine.js';
import { initWs, broadcast } from './ws.js';
import { processSignals } from './copyEngine.js';
import { resolveBinaryTrades } from './tradeEngine.js';

initDb();
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

import authRoutes from './routes/auth.js';
import kycRoutes from './routes/kyc.js';
import walletRoutes from './routes/wallet.js';
import marketRoutes from './routes/market.js';
import tradeRoutes from './routes/trades.js';
import copyRoutes from './routes/copy.js';
import referralRoutes from './routes/referral.js';
import adminRoutes from './routes/admin.js';
import securityRoutes from './routes/security.js';

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/copy', copyRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/security', securityRoutes);

// In production, serve the built React client and fall back to index.html
// for client-side routes (SPA). The client calls /api, /uploads and /ws
// on the same origin, so a single exposed port is enough.
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  });
} else {
  console.warn(`[WARN] Client build not found at ${CLIENT_DIR}. Run "npm run build" to build the frontend.`);
}

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initWs(server);
startPriceEngine();

setInterval(() => broadcast('prices', getPrices()), 1500);
setInterval(processSignals, 2000);
setInterval(resolveBinaryTrades, 2000);

server.listen(PORT, () => {
  console.log(`MASTER X API listening on http://0.0.0.0:${PORT} (${NODE_ENV})`);
});

function shutdown() {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
