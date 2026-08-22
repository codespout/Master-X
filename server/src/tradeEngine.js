import { db } from './db.js';
import { getPrice } from './priceEngine.js';
import { sendToUser } from './ws.js';
import { round2, notify, nowSql } from './utils.js';
import { creditProfitShare } from './copyEngine.js';

export function currentOutcome(trade, price) {
  if (!price) return 'pending';
  if (price === trade.entry_price) return 'tie';
  return trade.side === 'call'
    ? price > trade.entry_price ? 'won' : 'lost'
    : price < trade.entry_price ? 'won' : 'lost';
}

function resolveTrade(trade, exitPrice, reason) {
  const outcome = currentOutcome(trade, exitPrice);
  const now = nowSql();
  let pnl = 0;

  db.exec('BEGIN');
  try {
    if (outcome === 'won') {
      pnl = round2(trade.amount * (trade.payout_pct / 100));
      db.prepare('UPDATE users SET locked = locked - ?, balance = balance + ?, total_profit = total_profit + ? WHERE id = ?')
        .run(trade.amount, round2(trade.amount + pnl), pnl, trade.user_id);
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_win', ?, 'completed', ?)"
      ).run(trade.user_id, pnl, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: exitPrice }));
    } else if (outcome === 'lost') {
      pnl = -trade.amount;
      db.prepare('UPDATE users SET locked = locked - ? WHERE id = ?').run(trade.amount, trade.user_id);
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_loss', ?, 'completed', ?)"
      ).run(trade.user_id, pnl, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: exitPrice }));
    } else {
      db.prepare('UPDATE users SET locked = locked - ?, balance = balance + ? WHERE id = ?').run(trade.amount, trade.amount, trade.user_id);
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'option_tie', 0, 'completed', ?)"
      ).run(trade.user_id, JSON.stringify({ trade_id: trade.id, pair: trade.pair, entry: trade.entry_price, exit: exitPrice }));
    }
    db.prepare("UPDATE binary_trades SET status = ?, exit_price = ?, pnl = ?, closed_at = ? WHERE id = ?")
      .run(outcome, exitPrice, pnl, now, trade.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(trade.user_id);
  if (outcome === 'won' && user && user.referred_by) {
    try {
      creditProfitShare(user.referred_by, user.id, pnl);
    } catch (e) {
      console.error('profit share failed', e);
    }
  }

  const direction = trade.side === 'call' ? 'CALL' : 'PUT';
  if (outcome === 'won') {
    notify(db, trade.user_id, 'Binary Option Won', `${direction} ${trade.pair} expired in-the-money. +$${pnl} credited.`);
  } else if (outcome === 'lost') {
    notify(db, trade.user_id, 'Binary Option Lost', `${direction} ${trade.pair} expired out-of-the-money. -$${trade.amount} deducted.`);
  } else {
    notify(db, trade.user_id, 'Trade Refunded', `${direction} ${trade.pair} settled at the strike. Investment of $${trade.amount} refunded.`);
  }
  sendToUser(trade.user_id, 'trade_update', { trade_id: trade.id, status: outcome, pnl });
}

export function resolveBinaryTrades() {
  const due = db
    .prepare("SELECT * FROM binary_trades WHERE status = 'open' AND expires_at <= ?")
    .all(new Date().toISOString());
  for (const trade of due) {
    const price = getPrice(trade.pair);
    if (!price) continue;
    try {
      resolveTrade(trade, price, 'expiry');
    } catch (e) {
      console.error('resolveBinaryTrade failed', e);
    }
  }
}
