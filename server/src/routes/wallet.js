import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { ok, fail, publicSettings, round2, nowSql, notify, creditBalance, graceInfo } from '../utils.js';
import { requireAuth, upload } from '../middleware.js';
import { sendToUser } from '../ws.js';
import { creditDepositCommission, creditReferralBonus } from '../copyEngine.js';

const router = Router();

router.get('/config', (req, res) => ok(res, publicSettings(getSettings())));

router.get('/overview', requireAuth, (req, res) => {
  const txs = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  return ok(res, { balance: req.user.balance, locked: req.user.locked, txs });
});

router.get('/transactions', requireAuth, (req, res) => {
  const { type, status, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const args = [req.user.id];
  if (type) { sql += ' AND type = ?'; args.push(type); }
  if (status) { sql += ' AND status = ?'; args.push(status); }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  args.push(Number(limit), Number(offset));
  const rows = db.prepare(sql).all(...args);
  return ok(res, rows);
});

router.post('/deposit', requireAuth, upload.single('proof'), (req, res) => {
  const amount = Number(req.body.amount);
  const settings = getSettings();
  const min = Number(settings.min_deposit);
  const max = Number(settings.max_deposit || 0);
  if (!req.file) return fail(res, 'Please upload a transaction screenshot as proof');
  if (!amount || amount <= 0) return fail(res, 'Invalid deposit amount');
  if (amount < min) return fail(res, `Minimum deposit is $${min}`);
  if (max && amount > max) return fail(res, `Maximum deposit is $${max}`);

  const tx = db.prepare(
    "INSERT INTO transactions (user_id, type, amount, status, proof, meta, gross) VALUES (?, 'deposit', ?, 'pending', ?, ?, ?)"
  ).run(req.user.id, amount, `/uploads/${req.file.filename}`, JSON.stringify({ tx_ref: req.body.tx_ref || null }), amount);

  notify(db, req.user.id, 'Deposit Submitted', `Your deposit request of $${amount} is pending admin review.`);
  sendToUser(req.user.id, 'wallet_update', { type: 'deposit', status: 'pending' });
  return ok(res, { id: tx.lastInsertRowid, status: 'pending' }, 201);
});

router.post('/withdraw', requireAuth, (req, res) => {
  const { amount: rawAmount, address, network } = req.body || {};
  const amount = Number(rawAmount);
  const settings = getSettings();
  const min = Number(settings.min_withdrawal);
  const max = Number(settings.max_withdrawal || 0);
  const feePct = Number(settings.withdrawal_fee_pct);
  const taxPct = Number(settings.withdrawal_tax_pct);

  if (!amount || amount <= 0) return fail(res, 'Invalid withdrawal amount');
  if (amount < min) return fail(res, `Minimum withdrawal is $${min}`);
  if (max && amount > max) return fail(res, `Maximum withdrawal is $${max}`);
  if (!address || !String(address).trim()) return fail(res, 'Payout address is required');
  if (amount > req.user.balance) return fail(res, 'Insufficient balance');

  const g = graceInfo(req.user, settings);
  if (g.active) {
    return fail(res, `Withdrawals are locked during the ${g.days_left} day hold period. Hold ends ${new Date(g.ends_at).toLocaleDateString()}.`, 403);
  }

  const fee = round2(amount * (feePct / 100));
  const tax = round2(amount * (taxPct / 100));
  const net = round2(amount - fee - tax);

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, req.user.id);
    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, status, address, gross, fee, tax, net, meta) VALUES (?, 'withdrawal', ?, 'pending', ?, ?, ?, ?, ?, ?)"
    ).run(req.user.id, amount, String(address).trim(), amount, fee, tax, net, JSON.stringify({ network: network || 'USDT-TRC20' }));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  notify(db, req.user.id, 'Withdrawal Requested', `Withdrawal of $${amount} (net $${net} after fees & tax) is pending review.`);
  sendToUser(req.user.id, 'wallet_update', { type: 'withdrawal', status: 'pending' });
  return ok(res, { fee, tax, net, status: 'pending' }, 201);
});

export default router;
