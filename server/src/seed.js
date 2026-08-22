import bcrypt from 'bcryptjs';
import { db, initDb, setSetting } from './db.js';
import { randomRefCode } from './utils.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './config.js';

initDb();

function createUser(name, email, password, opts = {}) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return db.prepare('SELECT * FROM users WHERE id = ?').get(exists.id);
  let code = randomRefCode();
  while (db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code)) code = randomRefCode();
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (email, password_hash, name, role, kyc_status, referral_code, balance, total_deposited, total_profit, payout_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    email, hash, name, opts.role || 'user', opts.kyc || 'approved', code,
    opts.balance || 0, opts.deposited || 0, opts.profit || 0, opts.address || null
  );
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

const users = [
  createUser('Alice Carter', 'alice@example.com', 'Demo@1234', { balance: 4520.5, deposited: 5000, profit: 812.3, address: 'TXyz1234abc5678def9gh0ijKlm1nop2Qrs3tuv' }),
  createUser('Bob Martinez', 'bob@example.com', 'Demo@1234', { balance: 12800.25, deposited: 15000, profit: 2204.1, address: 'TAbC5678def9012ghIjKlMnOpQrStUvWxYz34567' }),
  createUser('Carol Nguyen', 'carol@example.com', 'Demo@1234', { balance: 950.75, deposited: 1000, profit: -45.2, kyc: 'pending', address: null }),
  createUser('Derek White', 'derek@example.com', 'Demo@1234', { balance: 3310.9, deposited: 3500, profit: 460.0, address: 'TQrS9012tuVwXyZ3456aBcDeFgHiJkLmNopQrSt' })
];

if (db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key='seeded'").get().c === 0) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('seeded', '1');
  const admin = db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get();
  const t = new Date().toISOString();
  const mkDep = (user, amount, daysAgo) => {
    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, status, gross, created_at) VALUES (?, 'deposit', ?, 'completed', ?, datetime('now', ?))"
    ).run(user.id, amount, amount, `-${daysAgo} days`);
  };
  mkDep(users[0], 2500, 9);
  mkDep(users[0], 2500, 4);
  mkDep(users[1], 10000, 6);
  mkDep(users[1], 5000, 2);
  mkDep(users[2], 1000, 3);
  mkDep(users[3], 3500, 5);

  const mkWin = (user, amount, pair, side = 'call') => {
    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, status, meta, created_at) VALUES (?, 'option_win', ?, 'completed', ?, datetime('now', ?))"
    ).run(user.id, amount, JSON.stringify({ pair, side }), `-${Math.ceil(Math.random() * 3)} days`);
  };
  mkWin(users[0], 640.2, 'BTCUSDT');
  mkWin(users[0], 172.1, 'ETHUSDT');
  mkWin(users[1], 1200, 'SOLUSDT');
  mkWin(users[1], 1004.1, 'BTCUSDT');
  mkWin(users[3], 460, 'DOGEUSDT');

  const createSignal = (code, pair, side, ret, percent, status, daysAgo, outcome) => {
    db.prepare(
      `INSERT INTO signals (code, pair, side, duration_secs, valid_secs, return_pct, loss_pct, percent, commission_pct, status, outcome, note, starts_at, created_at, expires_at, completes_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), datetime('now', ?), datetime('now', ?), datetime('now', ?))`
    ).run(code, pair, side, 600, 120, ret, 100, percent, 10, status, outcome || 'win', 'Historical signal', `-${daysAgo} days`, `-${daysAgo} days`, `-${daysAgo} days`, `-${daysAgo} days`, `-${daysAgo} days`);
  };
  createSignal('MXABC1', 'BTCUSDT', 'long', 8, 10, 'completed', 3, 'win');
  createSignal('MXDEF2', 'ETHUSDT', 'short', 12, 15, 'completed', 1, 'win');
  createSignal('MXGHI3', 'SOLUSDT', 'long', 6, 10, 'completed', 1, 'loss');

  const adminId = admin.id;
  db.prepare("INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'master_commission', ?, 'completed', ?)")
    .run(adminId, 145.6, JSON.stringify({ seeded: true }));
  db.prepare("INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'master_commission', ?, 'completed', ?)")
    .run(adminId, 268.4, JSON.stringify({ seeded: true }));
}

console.log('Seed complete.');
console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log('Demo users: alice@example.com / Demo@1234');
