import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { ok, fail, notify, publicSettings, round2 } from '../utils.js';
import { requireAuth } from '../middleware.js';
import { sendToUser } from '../ws.js';
import { getPrice } from '../priceEngine.js';

const router = Router();

function nowMs() {
  return Date.now();
}

router.get('/signals', requireAuth, (req, res) => {
  const signals = db
    .prepare("SELECT * FROM signals WHERE status = 'active' OR status = 'completed' ORDER BY id DESC LIMIT 20")
    .all();

  const joined = db
    .prepare('SELECT signal_id, status, amount, pnl, commission, entry_price FROM copy_trades WHERE user_id = ?')
    .all(req.user.id);
  const joinedMap = {};
  for (const j of joined) {
    if (!joinedMap[j.signal_id]) joinedMap[j.signal_id] = [];
    joinedMap[j.signal_id].push(j);
  }

  const now = nowMs();
  return ok(
    res,
    signals.map((s) => {
      const startsAt = Date.parse(s.starts_at || s.created_at);
      const completesAt = Date.parse(s.completes_at);
      const expired = s.status === 'active' && now > startsAt;
      const notStarted = s.status === 'active' && now < startsAt;
      return {
        ...s,
        code_expired: expired,
        not_started: notStarted,
        starts_at: s.starts_at || s.created_at,
        remaining_valid_ms: Math.max(0, startsAt - now),
        remaining_trade_ms: Math.max(0, completesAt - now),
        starts_in_ms: Math.max(0, startsAt - now),
        my_copies: joinedMap[s.id] || [],
        copier_count: db.prepare('SELECT COUNT(*) AS c FROM copy_trades WHERE signal_id = ?').get(s.id).c
      };
    })
  );
});

router.post('/join', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const signal = db.prepare('SELECT * FROM signals WHERE code = ?').get(String(code || '').trim().toUpperCase());

  if (!signal) return fail(res, 'Invalid code. Check and try again.');
  if (signal.status !== 'active') return fail(res, 'This signal is no longer active');
  if (nowMs() > Date.parse(signal.expires_at)) return fail(res, 'Code expired. Wait for the next signal.');
  if (publicSettings(getSettings()).enable_copy === false) return fail(res, 'Copy trading is currently disabled by the platform');

  const percent = Number(signal.percent || 0);
  if (percent <= 0 || percent > 100) return fail(res, 'This signal has no investment percentage configured');
  const amount = round2((req.user.balance * percent) / 100);
  if (amount <= 0) return fail(res, 'Insufficient balance to copy this trade');
  if (amount > req.user.balance) return fail(res, 'Insufficient balance');

  const openCopyCount = db
    .prepare("SELECT COUNT(*) AS c FROM copy_trades ct JOIN signals s ON s.id = ct.signal_id WHERE ct.user_id = ? AND ct.status = 'active'")
    .get(req.user.id).c;
  if (openCopyCount >= Number(getSettings().max_open_copy_trades || 20)) {
    return fail(res, 'You have reached the maximum number of concurrent copy trades');
  }

  const already = db.prepare("SELECT id FROM copy_trades WHERE signal_id = ? AND user_id = ? AND status = 'active'")
    .get(signal.id, req.user.id);
  if (already) return fail(res, 'You already joined this trade');

  const entryPrice = getPrice(signal.pair);

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET balance = balance - ?, locked = locked + ? WHERE id = ?').run(amount, amount, req.user.id);
    const result = db.prepare('INSERT INTO copy_trades (signal_id, user_id, amount, entry_price) VALUES (?, ?, ?, ?)')
      .run(signal.id, req.user.id, amount, entryPrice);
    db.exec('COMMIT');
    notify(db, req.user.id, 'Copy Trade Joined',
      `You joined signal ${signal.code} (${signal.pair}) with $${amount} (${percent}% of balance) at ${entryPrice}. Locked until trade completes.`);
    sendToUser(req.user.id, 'copy_update', { signal_id: signal.id, status: 'active', amount });
    return ok(res, { id: result.lastInsertRowid, signal_id: signal.id, status: 'active', amount, percent, entry_price: entryPrice }, 201);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

router.get('/history', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT ct.*, s.code, s.pair, s.side, s.return_pct, s.outcome, s.completed_at AS signal_completed_at
       FROM copy_trades ct JOIN signals s ON s.id = ct.signal_id
       WHERE ct.user_id = ? ORDER BY ct.id DESC LIMIT 100`
    )
    .all(req.user.id);
  return ok(res, rows);
});

export default router;
