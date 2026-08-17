import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, getSettings, setSetting, getSetting } from '../db.js';
import { ok, fail, round2, nowSql, notify, publicUser, randomCode } from '../utils.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { sendToUser, broadcast } from '../ws.js';
import { resolveSignal, creditDepositCommission, creditReferralBonus } from '../copyEngine.js';

function passwordIssues(pw) {
  const issues = [];
  const s = String(pw || '');
  const minLen = Math.max(6, Number(getSetting('min_password_length', '8')) || 8);
  if (s.length < minLen) issues.push(`at least ${minLen} characters`);
  if (!/[a-z]/.test(s)) issues.push('a lowercase letter');
  if (!/[A-Z]/.test(s)) issues.push('an uppercase letter');
  if (!/\d/.test(s)) issues.push('a number');
  if (s.length > 128) issues.push('no more than 128 characters');
  return issues;
}

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', (req, res) => {
  const range = String(req.query.range || '7d');
  const RANGES = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365, all: null };
  const days = RANGES[range] !== undefined ? RANGES[range] : 7;
  const sinceFilter = days ? "created_at >= datetime('now', ?)" : '1 = 1';
  const sinceArg = days ? [`-${days} days`] : [];

  const scalar = (sql, ...args) => db.prepare(sql).get(...args);
  const totalUsers = scalar('SELECT COUNT(*) AS c FROM users').c;
  const activeUsers = scalar("SELECT COUNT(*) AS c FROM users WHERE status = 'active'").c;

  const newSignups = scalar(`SELECT COUNT(*) AS c FROM users WHERE ${sinceFilter}`, ...sinceArg).c;
  const deposits = scalar(`SELECT COALESCE(SUM(gross),0) AS s FROM transactions WHERE type = 'deposit' AND status = 'completed' AND ${sinceFilter}`, ...sinceArg).s;
  const depositCount = scalar(`SELECT COUNT(*) AS c FROM transactions WHERE type = 'deposit' AND status = 'completed' AND ${sinceFilter}`, ...sinceArg).c;
  const withdrawals = scalar(`SELECT COALESCE(SUM(net),0) AS s FROM transactions WHERE type = 'withdrawal' AND status = 'completed' AND ${sinceFilter}`, ...sinceArg).s;
  const withdrawalCount = scalar(`SELECT COUNT(*) AS c FROM transactions WHERE type = 'withdrawal' AND status = 'completed' AND ${sinceFilter}`, ...sinceArg).c;

  const masterCommission = scalar(`SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type = 'master_commission' AND ${sinceFilter}`, ...sinceArg).s;
  const referralCommission = scalar(`SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type = 'commission' AND ${sinceFilter}`, ...sinceArg).s;
  const bonuses = scalar(`SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type = 'bonus' AND ${sinceFilter}`, ...sinceArg).s;

  const binaryVolume = scalar(`SELECT COALESCE(SUM(amount),0) AS s FROM binary_trades WHERE status != 'open' AND opened_at >= datetime('now', ?)`, sinceArg[0] || '-3650 days').s;
  const binaryProfit = scalar(`SELECT COALESCE(SUM(pnl),0) AS s FROM binary_trades WHERE status = 'won' AND closed_at >= datetime('now', ?)`, sinceArg[0] || '-3650 days').s;

  const pendingKyc = scalar("SELECT COUNT(*) AS c FROM users WHERE kyc_status = 'pending'").c;
  const pendingDeposits = scalar("SELECT COUNT(*) AS c FROM transactions WHERE type = 'deposit' AND status = 'pending'").c;
  const pendingWithdrawals = scalar("SELECT COUNT(*) AS c FROM transactions WHERE type = 'withdrawal' AND status = 'pending'").c;

  const signupsByDay = db
    .prepare(`SELECT date(created_at) AS day, COUNT(*) AS c FROM users WHERE ${sinceFilter} GROUP BY day ORDER BY day`)
    .all(...sinceArg);
  const depositsByDay = db
    .prepare(`SELECT date(created_at) AS day, COALESCE(SUM(gross),0) AS s FROM transactions WHERE type = 'deposit' AND status = 'completed' AND ${sinceFilter} GROUP BY day ORDER BY day`)
    .all(...sinceArg);

  return ok(res, {
    range,
    totalUsers,
    activeUsers,
    newSignups,
    deposits,
    depositCount,
    withdrawals,
    withdrawalCount,
    masterCommission,
    referralCommission,
    bonuses,
    totalRevenue: Number(masterCommission),
    pendingKyc,
    pendingDeposits,
    pendingWithdrawals,
    binaryVolume,
    binaryProfit,
    signupsByDay,
    depositsByDay
  });
});

router.get('/users', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare("SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY id DESC LIMIT 200")
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 200').all();
  }
  return ok(res, rows.map((u) => ({ ...publicUser(u), password_hash: undefined })));
});

router.post('/users/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'banned'].includes(status)) return fail(res, 'Invalid status');
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  return ok(res, { updated: true });
});

router.put('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 'User not found', 404);
  const { name, email, role, status, kyc_status, payout_address, payout_network, referred_by, telegram_id, grace_ends_at } = req.body || {};

  if (email) {
    const dupe = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(String(email).trim().toLowerCase(), user.id);
    if (dupe) return fail(res, 'Email already in use');
  }

  const fields = {};
  if (name !== undefined) fields.name = String(name).trim();
  if (email !== undefined) fields.email = String(email).trim().toLowerCase();
  if (role !== undefined && ['user', 'admin'].includes(role)) fields.role = role;
  if (status !== undefined && ['active', 'banned'].includes(status)) fields.status = status;
  if (kyc_status !== undefined && ['none', 'pending', 'approved', 'rejected'].includes(kyc_status)) fields.kyc_status = kyc_status;
  if (payout_address !== undefined) fields.payout_address = String(payout_address).trim();
  if (payout_network !== undefined) fields.payout_network = String(payout_network).trim();
  if (telegram_id !== undefined) fields.telegram_id = telegram_id ? String(telegram_id).trim() : null;
  if (grace_ends_at !== undefined) fields.grace_ends_at = grace_ends_at ? new Date(grace_ends_at).toISOString() : null;

  const keys = Object.keys(fields);
  if (keys.length > 0) {
    const set = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...Object.values(fields), user.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  notify(db, user.id, 'Account Updated', 'Your account details were updated by the administrator.');
  return ok(res, publicUser(updated));
});

router.post('/users/:id/adjust', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 'User not found', 404);
  const amount = Number(req.body.amount);
  const note = String(req.body.note || 'Manual balance adjustment');
  if (!Number.isFinite(amount) || amount === 0) return fail(res, 'Adjustment amount must be a non-zero number');

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, user.id);
    if (amount > 0) db.prepare('UPDATE users SET total_deposited = total_deposited + ? WHERE id = ?').run(amount, user.id);
    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, status, meta, reviewed_by, reviewed_at) VALUES (?, 'adjustment', ?, 'completed', ?, ?, ?)"
    ).run(user.id, amount, JSON.stringify({ note, by_admin: true }), req.user.id, nowSql());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  notify(db, user.id, 'Balance Updated', `Admin ${amount >= 0 ? 'credited' : 'debited'} $${Math.abs(amount)} (${note}).`);
  return ok(res, { updated: true });
});

router.post('/users/:id/grace', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 'User not found', 404);
  const days = Math.max(0, Number(req.body.days));
  if (!Number.isFinite(days)) return fail(res, 'Days must be a number');
  const endsAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  db.prepare('UPDATE users SET grace_ends_at = ? WHERE id = ?').run(endsAt, user.id);
  notify(db, user.id, 'Hold Period Set', days > 0
    ? `A ${days} day withdrawal hold was applied to your account by an administrator.`
    : 'The withdrawal hold on your account has been removed.');
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return ok(res, publicUser(updated));
});

router.post('/users/:id/password', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 'User not found', 404);
  const { new_password } = req.body || {};
  const issues = passwordIssues(new_password);
  if (issues.length) return fail(res, `New password must include ${issues.join(', ')}.`);
  const hash = bcrypt.hashSync(String(new_password), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  notify(db, user.id, 'Password Reset', 'An administrator reset your account password. Use the new password to sign in.');
  return ok(res, { updated: true });
});

router.get('/kyc', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db.prepare('SELECT * FROM users WHERE kyc_status = ? ORDER BY id DESC').all(status);
  return ok(res, rows.map((u) => ({ ...publicUser(u), kyc_docs: u.kyc_docs ? JSON.parse(u.kyc_docs) : [] })));
});

router.post('/kyc/:id', (req, res) => {
  const { action, message } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 'User not found', 404);
  if (action === 'approve') {
    db.prepare("UPDATE users SET kyc_status = 'approved', kyc_message = ?, kyc_reviewed_at = ? WHERE id = ?")
      .run(message || 'Identity verified successfully.', nowSql(), user.id);
    notify(db, user.id, 'KYC Approved', message || 'Your identity has been verified successfully.');
  } else if (action === 'reject') {
    db.prepare("UPDATE users SET kyc_status = 'rejected', kyc_message = ?, kyc_reviewed_at = ? WHERE id = ?")
      .run(message || 'Documents could not be verified.', nowSql(), user.id);
    notify(db, user.id, 'KYC Rejected', message || 'Your documents could not be verified. Please resubmit.');
  } else {
    return fail(res, 'Action must be approve or reject');
  }
  sendToUser(user.id, 'kyc_update', { status: action === 'approve' ? 'approved' : 'rejected' });
  return ok(res, { updated: true });
});

router.get('/deposits', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db
    .prepare('SELECT t.*, u.name, u.email FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.type = ? AND t.status = ? ORDER BY t.id DESC')
    .all('deposit', status);
  return ok(res, rows);
});

router.post('/deposits/:id', (req, res) => {
  const { action } = req.body || {};
  const tx = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'deposit'").get(req.params.id);
  if (!tx) return fail(res, 'Deposit not found', 404);
  if (tx.status !== 'pending') return fail(res, 'Deposit already reviewed');

  if (action === 'approve') {
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE transactions SET status = 'completed', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
        .run(req.user.id, nowSql(), tx.id);
      db.prepare('UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE id = ?')
        .run(tx.gross, tx.gross, tx.user_id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    notify(db, tx.user_id, 'Deposit Approved', `Your deposit of $${tx.gross} has been credited to your balance.`);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(tx.user_id);
    if (user.referred_by) {
      creditDepositCommission(user.referred_by, user.id, tx.gross);
      const firstDeposit = user.total_deposited - tx.gross <= 0;
      if (firstDeposit) {
        db.prepare('UPDATE referrals SET bonus_paid = 1 WHERE referrer_id = ? AND referred_id = ?')
          .run(user.referred_by, user.id);
        creditReferralBonus(user.referred_by, user.id, tx.gross);
      }
    }
    sendToUser(tx.user_id, 'wallet_update', { type: 'deposit', status: 'completed' });
  } else if (action === 'reject') {
    db.prepare("UPDATE transactions SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
      .run(req.user.id, nowSql(), tx.id);
    notify(db, tx.user_id, 'Deposit Rejected', `Your deposit of $${tx.gross} was rejected. Contact support for details.`);
    sendToUser(tx.user_id, 'wallet_update', { type: 'deposit', status: 'rejected' });
  } else {
    return fail(res, 'Action must be approve or reject');
  }
  return ok(res, { updated: true });
});

router.get('/withdrawals', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db
    .prepare('SELECT t.*, u.name, u.email FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.type = ? AND t.status = ? ORDER BY t.id DESC')
    .all('withdrawal', status);
  return ok(res, rows);
});

router.post('/withdrawals/:id', (req, res) => {
  const { action } = req.body || {};
  const tx = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'withdrawal'").get(req.params.id);
  if (!tx) return fail(res, 'Withdrawal not found', 404);
  if (tx.status !== 'pending') return fail(res, 'Withdrawal already reviewed');

  if (action === 'approve' || action === 'fulfill') {
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE transactions SET status = 'completed', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
        .run(req.user.id, nowSql(), tx.id);
      db.prepare('UPDATE users SET total_withdrawn = total_withdrawn + ? WHERE id = ?')
        .run(tx.net, tx.user_id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    notify(db, tx.user_id, 'Withdrawal Fulfilled', `Your withdrawal of $${tx.net} to ${tx.address} has been processed.`);
    sendToUser(tx.user_id, 'wallet_update', { type: 'withdrawal', status: 'completed' });
  } else if (action === 'reject') {
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE transactions SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
        .run(req.user.id, nowSql(), tx.id);
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(tx.gross, tx.user_id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    notify(db, tx.user_id, 'Withdrawal Rejected', `Your withdrawal of $${tx.gross} was rejected and funds returned to your balance.`);
    sendToUser(tx.user_id, 'wallet_update', { type: 'withdrawal', status: 'rejected' });
  } else {
    return fail(res, 'Action must be approve, fulfill or reject');
  }
  return ok(res, { updated: true });
});

router.get('/signals', (req, res) => {
  const rows = db.prepare('SELECT * FROM signals ORDER BY id DESC LIMIT 100').all();
  return ok(res, rows);
});

router.post('/signals', (req, res) => {
  const {
    pair,
    side,
    duration_secs,
    valid_secs,
    return_pct,
    loss_pct,
    percent,
    commission_pct,
    outcome,
    note
  } = req.body || {};

  if (!pair || (side !== 'long' && side !== 'short')) return fail(res, 'Pair and side (long/short) required');
  if (!outcome || !['win', 'loss'].includes(outcome)) return fail(res, 'Outcome must be win or loss');
  const dur = Math.max(15, Number(duration_secs) || Number(getSettings().default_duration_secs || 600));
  const valid = Math.max(5, Number(valid_secs) || Number(getSettings().code_valid_secs || 120));
  const ret = Number(return_pct) || 0;
  const loss = Number(loss_pct) || 100;
  const pct = Number(percent) || 0;
  if (pct <= 0 || pct > 100) return fail(res, 'Investment percentage must be between 1 and 100');
  const comm = commission_pct !== undefined ? Number(commission_pct) : Number(getSettings().master_commission_pct || 10);

  let code = randomCode(6);
  while (db.prepare('SELECT id FROM signals WHERE code = ?').get(code)) code = randomCode(6);

  const now = Date.now();
  const startsAt = now + valid * 1000;
  const result = db.prepare(
    `INSERT INTO signals (code, pair, side, duration_secs, valid_secs, return_pct, loss_pct, percent, commission_pct, outcome, note, starts_at, expires_at, completes_at, min_amount, max_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  ).run(
    code, pair, side, dur, valid, ret, loss, pct, comm, outcome, note || null,
    new Date(startsAt).toISOString(),
    new Date(startsAt).toISOString(),
    new Date(startsAt + dur * 1000).toISOString()
  );

  const signal = db.prepare('SELECT * FROM signals WHERE id = ?').get(result.lastInsertRowid);
  broadcast('new_signal', signal);
  return ok(res, signal, 201);
});

router.post('/signals/:id/resolve', (req, res) => {
  const { action } = req.body || {};
  const signal = db.prepare("SELECT * FROM signals WHERE status = 'active' AND id = ?").get(req.params.id);
  if (!signal) return fail(res, 'Active signal not found', 404);
  if (action !== 'win' && action !== 'loss') return fail(res, 'Action must be win or loss');
  db.prepare("UPDATE signals SET outcome = ? WHERE id = ?").run(action, signal.id);
  resolveSignal(db.prepare('SELECT * FROM signals WHERE id = ?').get(signal.id));
  return ok(res, { resolved: true });
});

router.post('/signals/:id/cancel', (req, res) => {
  const signal = db.prepare("SELECT * FROM signals WHERE status = 'active' AND id = ?").get(req.params.id);
  if (!signal) return fail(res, 'Active signal not found', 404);
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE signals SET status = 'cancelled', completed_at = ? WHERE id = ?").run(nowSql(), signal.id);
    const copies = db.prepare("SELECT * FROM copy_trades WHERE signal_id = ? AND status = 'active'").all(signal.id);
    for (const cp of copies) {
      db.prepare("UPDATE copy_trades SET status = 'expired', completed_at = ? WHERE id = ?").run(nowSql(), cp.id);
      db.prepare('UPDATE users SET locked = locked - ?, balance = balance + ? WHERE id = ?').run(cp.amount, cp.amount, cp.user_id);
      notify(db, cp.user_id, 'Signal Cancelled', `Signal ${signal.code} was cancelled. Your $${cp.amount} was refunded.`);
      sendToUser(cp.user_id, 'copy_update', { signal_id: signal.id, status: 'expired' });
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  broadcast('signal_update', { id: signal.id, status: 'cancelled' });
  return ok(res, { cancelled: true });
});

router.get('/settings', (req, res) => ok(res, getSettings()));

router.put('/settings', (req, res) => {
  const body = req.body || {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' || typeof v === 'number') setSetting(k, String(v));
  }
  return ok(res, getSettings());
});

export default router;
