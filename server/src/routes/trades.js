import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { ok, fail, round2, notify, publicSettings } from '../utils.js';
import { requireAuth } from '../middleware.js';
import { getPrice } from '../priceEngine.js';
import { sendToUser } from '../ws.js';
import { currentOutcome } from '../tradeEngine.js';

const router = Router();

function attachLive(trade) {
  const price = getPrice(trade.pair);
  if (!trade.exit_price && price) {
    trade.mark = price;
    trade.current_outcome = currentOutcome(trade, price);
    trade.remaining_ms = Math.max(0, Date.parse(trade.expires_at) - Date.now());
    trade.potential_pnl = round2(trade.amount * (trade.payout_pct / 100));
  }
  return trade;
}

router.get('/', requireAuth, (req, res) => {
  const open = db
    .prepare("SELECT * FROM binary_trades WHERE user_id = ? AND status = 'open' ORDER BY id DESC")
    .all(req.user.id);
  return ok(res, open.map(attachLive));
});

router.post('/open', requireAuth, (req, res) => {
  const { pair, side, amount: rawAmount, expiry_secs } = req.body || {};
  const amount = Number(rawAmount);
  const expiry = Number(expiry_secs);
  const settings = getSettings();
  const publicCfg = publicSettings(settings);
  const price = getPrice(String(pair || ''));

  if (publicCfg.enable_binary === false) return fail(res, 'Binary options trading is currently disabled by the platform');
  if (publicCfg.kyc_required && req.user.kyc_status !== 'approved') {
    return fail(res, 'KYC verification required before trading');
  }
  if (!pair || !price) return fail(res, 'Invalid trading pair');
  if (side !== 'call' && side !== 'put') return fail(res, 'Direction must be call (up) or put (down)');
  if (!amount || amount <= 0) return fail(res, 'Invalid investment amount');
  if (amount < publicCfg.binary_min_amount) return fail(res, `Minimum investment is $${publicCfg.binary_min_amount}`);
  if (amount > publicCfg.binary_max_amount) return fail(res, `Maximum investment is $${publicCfg.binary_max_amount}`);
  if (!publicCfg.binary_expiries.includes(expiry)) return fail(res, 'Invalid expiry duration');
  if (amount > req.user.balance) return fail(res, 'Insufficient balance');

  const openCount = db.prepare("SELECT COUNT(*) AS c FROM binary_trades WHERE user_id = ? AND status = 'open'").get(req.user.id).c;
  if (openCount >= publicCfg.max_open_binary_trades) {
    return fail(res, `You can have at most ${publicCfg.max_open_binary_trades} open trades. Close one first.`);
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET balance = balance - ?, locked = locked + ? WHERE id = ?').run(amount, amount, req.user.id);
    const result = db.prepare(
      `INSERT INTO binary_trades (user_id, pair, side, amount, payout_pct, entry_price, expiry_secs, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      pair,
      side,
      amount,
      publicCfg.binary_payout_pct,
      price,
      expiry,
      new Date(Date.now() + expiry * 1000).toISOString()
    );
    db.exec('COMMIT');
    const trade = db.prepare('SELECT * FROM binary_trades WHERE id = ?').get(result.lastInsertRowid);
    notify(db, req.user.id, 'Binary Option Opened',
      `${side === 'call' ? 'CALL' : 'PUT'} ${pair} opened at ${price} with $${amount}. Expires in ${expiry}s.`);
    return ok(res, attachLive(trade), 201);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

router.post('/:id/close', requireAuth, (req, res) => {
  const trade = db
    .prepare("SELECT * FROM binary_trades WHERE id = ? AND user_id = ? AND status = 'open'")
    .get(req.params.id, req.user.id);
  if (!trade) return fail(res, 'Open trade not found', 404);
  const price = getPrice(trade.pair);
  if (!price) return fail(res, 'Market data unavailable, try again');

  const outcome = currentOutcome(trade, price);
  const now = new Date().toISOString();
  const pnl = outcome === 'won' ? round2(trade.amount * (trade.payout_pct / 100)) : outcome === 'lost' ? -trade.amount : 0;

  db.exec('BEGIN');
  try {
    if (outcome === 'won') {
      db.prepare('UPDATE users SET locked = locked - ?, balance = balance + ?, total_profit = total_profit + ? WHERE id = ?')
        .run(trade.amount, round2(trade.amount + pnl), pnl, req.user.id);
      db.prepare("INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_win', ?, 'completed', ?)")
        .run(req.user.id, pnl, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: price, early: true }));
    } else if (outcome === 'lost') {
      db.prepare('UPDATE users SET locked = locked - ? WHERE id = ?').run(trade.amount, req.user.id);
      db.prepare("INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_loss', ?, 'completed', ?)")
        .run(req.user.id, pnl, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: price, early: true }));
    } else {
      db.prepare('UPDATE users SET locked = locked - ?, balance = balance + ? WHERE id = ?').run(trade.amount, trade.amount, req.user.id);
      db.prepare("INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_tie', 0, 'completed', ?)")
        .run(req.user.id, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: price, early: true }));
    }
    db.prepare("UPDATE binary_trades SET status = ?, exit_price = ?, pnl = ?, closed_at = ? WHERE id = ?")
      .run(outcome, price, pnl, now, trade.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  notify(db, req.user.id, 'Binary Option Closed Early',
    `${trade.side.toUpperCase()} ${trade.pair} closed at ${price}. Result: ${outcome.toUpperCase()} (${pnl >= 0 ? '+' : ''}$${pnl}).`);
  sendToUser(req.user.id, 'trade_update', { trade_id: trade.id, status: outcome, pnl });
  return ok(res, { trade_id: trade.id, exit_price: price, outcome, pnl });
});

router.get('/history', requireAuth, (req, res) => {
  const closed = db
    .prepare("SELECT * FROM binary_trades WHERE user_id = ? AND status != 'open' ORDER BY id DESC LIMIT 100")
    .all(req.user.id);
  return ok(res, closed.map(attachLive));
});

export default router;
