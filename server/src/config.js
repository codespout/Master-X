import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the process cwd (repo root when started via `npm start`)
// and, as a fallback, from the server directory itself.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const NODE_ENV = process.env.NODE_ENV || 'production';
export const PORT = process.env.PORT || 3001;

const DEV_JWT_SECRET = 'master-x-dev-secret-change-me';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET === DEV_JWT_SECRET)) {
  console.warn(
    '[WARN] JWT_SECRET is not set or still the default value. ' +
    'Set a strong random value in your .env file (e.g. via `openssl rand -hex 32`).'
  );
}

export const JWT_EXPIRES = '7d';

export const SERVER_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(SERVER_DIR, 'data');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'masterx.db');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(SERVER_DIR, 'uploads');
export const CLIENT_DIR = process.env.CLIENT_DIR || path.resolve(SERVER_DIR, '../client/dist');

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@masterx.io';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
export const ADMIN_NAME = 'Master Admin';

export const MAX_LEVERAGE = 125;
export const PAIRS = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', seed: 67450.5, precision: 1 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', seed: 3482.2, precision: 2 },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', seed: 592.7, precision: 2 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', seed: 172.4, precision: 2 },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', seed: 0.62, precision: 4 },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', seed: 0.158, precision: 5 },
];
