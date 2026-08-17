import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import { PORT, UPLOAD_DIR } from './config.js';
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
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initWs(server);
startPriceEngine();

setInterval(() => broadcast('prices', getPrices()), 1500);
setInterval(processSignals, 2000);
setInterval(resolveBinaryTrades, 2000);

server.listen(PORT, () => {
  console.log(`MASTER X API listening on http://0.0.0.0:${PORT}`);
});
