import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { DB_PATH, DATA_DIR, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } from './config.js';
import bcrypt from 'bcryptjs';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  kyc_status TEXT NOT NULL DEFAULT 'none',
  kyc_docs TEXT,
  kyc_message TEXT,
  kyc_submitted_at TEXT,
  kyc_reviewed_at TEXT,
  payout_address TEXT,
  payout_network TEXT,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  telegram_id TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  locked REAL NOT NULL DEFAULT 0,
  total_deposited REAL NOT NULL DEFAULT 0,
  total_withdrawn REAL NOT NULL DEFAULT 0,
  total_profit REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  proof TEXT,
  address TEXT,
  gross REAL,
  fee REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  net REAL,
  meta TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS binary_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  amount REAL NOT NULL,
  payout_pct REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  pnl REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  expiry_secs INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  duration_secs INTEGER NOT NULL,
  valid_secs INTEGER NOT NULL,
  return_pct REAL NOT NULL,
  loss_pct REAL NOT NULL DEFAULT 100,
  min_amount REAL NOT NULL,
  max_amount REAL NOT NULL,
  commission_pct REAL NOT NULL,
  percent REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  outcome TEXT NOT NULL DEFAULT 'win',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  starts_at TEXT,
  expires_at TEXT NOT NULL,
  completes_at TEXT NOT NULL,
  completed_at TEXT,
  result_message TEXT
);

CREATE TABLE IF NOT EXISTS copy_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  pnl REAL DEFAULT 0,
  commission REAL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE (signal_id, user_id),
  FOREIGN KEY (signal_id) REFERENCES signals(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referred_id INTEGER NOT NULL,
  bonus_paid REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (referrer_id, referred_id),
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_binary_user ON binary_trades(user_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_copy_user ON copy_trades(user_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_signal_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
`;

db.exec(SCHEMA);

function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

addColumnIfMissing('copy_trades', 'entry_price', 'entry_price REAL');
addColumnIfMissing('users', 'telegram_id', 'telegram_id TEXT');
addColumnIfMissing('users', 'totp_secret', 'totp_secret TEXT');
addColumnIfMissing('users', 'totp_enabled', 'totp_enabled INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'grace_ends_at', 'grace_ends_at TEXT');
addColumnIfMissing('signals', 'percent', 'percent REAL NOT NULL DEFAULT 0');
addColumnIfMissing('signals', 'starts_at', 'starts_at TEXT');

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

export function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const code = 'ADMIN' + String(Date.now()).slice(-6);
    db.prepare(
      'INSERT INTO users (email, password_hash, name, role, kyc_status, referral_code) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(ADMIN_EMAIL, hash, ADMIN_NAME, 'admin', 'approved', code);
  }

  const defaults = {
    deposit_address: 'TWc1XsE8kFm9YhQv4rNx6pZa7dLc3BsJ2K',
    deposit_network: 'TRC20 (Tether USDT)',
    min_deposit: '10',
    max_deposit: '10000',
    min_withdrawal: '10',
    max_withdrawal: '5000',
    withdrawal_fee_pct: '2',
    withdrawal_tax_pct: '1',
    referral_bonus_pct: '5',
    referral_min_first_deposit: '10',
    code_valid_secs: '120',
    master_commission_pct: '10',
    default_return_pct: '12',
    default_duration_secs: '600',
    telegram_link: 'https://t.me/masterxsignals',
    contact_email: 'support@masterx.io',
    binary_min_amount: '5',
    binary_max_amount: '5000',
    binary_payout_pct: '85',
    binary_expiries: '60,300,900,1800,3600',
    max_open_binary_trades: '10',
    max_open_copy_trades: '20',
    rank_shares: JSON.stringify({
      BR: { deposit: 5, profit: 1 },
      JR: { deposit: 7, profit: 2 },
      SR: { deposit: 9, profit: 3 },
      EL: { deposit: 12, profit: 5 },
      MT: { deposit: 15, profit: 8 }
    }),
    allow_signup: 'true',
    enable_binary: 'true',
    enable_copy: 'true',
    enable_referrals: 'true',
    kyc_required: 'true',
    min_password_length: '8',
    max_login_attempts: '5',
    login_lockout_minutes: '15',
    session_timeout_minutes: '10080',
    require_admin_2fa: 'false',
    withdrawal_grace_days: '7'
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!getSetting(k, null)) setSetting(k, v);
  }
}

export function initDb() {
  seedIfEmpty();
}
