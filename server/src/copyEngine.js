import { db, getSetting } from './db.js';
import { broadcast, sendToUser } from './ws.js';
import { round2, notify, creditBalance, nowSql } from './utils.js';
import { rankForRefs, rankShare } from './ranks.js';
import { getPrice } from './priceEngine.js';

export function successfulRefCount(userId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM referrals r JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = ? AND u.total_deposited >= ?`
    )
    .get(userId, Number(getSetting('referral_min_first_deposit', '10')));
  return row.c;
}

export function creditDepositCommission(referrerId, referredUserId, depositAmount) {
  const refs = successfulRefCount(referrerId);
  const rank = rankForRefs(refs);
  const commission = round2(depositAmount * (rankShare(rank.code, 'deposit') / 100));
  if (commission <= 0) return null;
  creditBalance(db, referrerId, commission);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, ?, ?, ?, ?)'
  ).run(referrerId, 'commission', commission, 'completed', JSON.stringify({ kind: 'deposit_commission', rank: rank.code, ref_user: referredUserId }));
  notify(db, referrerId, 'Referral Commission', `You earned $${commission} commission on a referral deposit.`);
  return commission;
}

export function creditProfitShare(referrerId, referredUserId, profit) {
  const refs = successfulRefCount(referrerId);
  const rank = rankForRefs(refs);
  const share = round2(profit * (rankShare(rank.code, 'profit') / 100));
  if (share <= 0) return null;
  creditBalance(db, referrerId, share);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, ?, ?, ?, ?)'
  ).run(referrerId, 'commission', share, 'completed', JSON.stringify({ kind: 'profit_share', rank: rank.code, ref_user: referredUserId }));
  notify(db, referrerId, 'Profit Share', `You earned $${share} profit share from a referral's winning trade.`);
  return share;
}

export function creditReferralBonus(referrerId, referredUserId, firstDeposit) {
  const pct = Number(getSetting('referral_bonus_pct', '5'));
  const bonus = round2(firstDeposit * (pct / 100));
  if (bonus <= 0) return null;
  creditBalance(db, referrerId, bonus);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, ?, ?, ?, ?)'
  ).run(referrerId, 'bonus', bonus, 'completed', JSON.stringify({ kind: 'referral_bonus', ref_user: referredUserId }));
  notify(db, referrerId, 'Referral Bonus', `You earned a $${bonus} referral bonus (${pct}% of their first deposit)!`);
  return bonus;
}

function computeCopyOutcome(signal, amount) {
  const gross = amount * (signal.return_pct / 100);
  const commission = round2(gross * (signal.commission_pct / 100));
  const net = round2(gross - commission);
  return { gross, commission, net };
}

export function resolveSignal(signal) {
  db.exec('BEGIN');
  try {
    const now = nowSql();
    const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();

    const copies = db
      .prepare("SELECT * FROM copy_trades WHERE signal_id = ? AND status = 'active'")
      .all(signal.id);

    for (const cp of copies) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(cp.user_id);
      let pnl = 0;
      let commission = 0;

      if (signal.outcome === 'win') {
        const r = computeCopyOutcome(signal, cp.amount);
        pnl = r.net;
        commission = r.commission;

        db.prepare('UPDATE users SET balance = balance + ?, locked = locked - ?, total_profit = total_profit + ? WHERE id = ?')
          .run(round2(cp.amount + pnl), cp.amount, pnl, cp.user_id);

        db.prepare(
          "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'copy_win', ?, 'completed', ?)"
        ).run(cp.user_id, pnl, JSON.stringify({ signal_code: signal.code, pair: signal.pair, gross: r.gross, commission }));

        if (admin) {
          db.prepare(
            "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'master_commission', ?, 'completed', ?)"
          ).run(admin.id, commission, JSON.stringify({ signal_code: signal.code, copier: cp.user_id }));
        }

        if (user.referred_by) {
          creditProfitShare(user.referred_by, user.id, pnl);
        }

        notify(db, cp.user_id, 'Copy Trade Won', `Signal ${signal.code} (${signal.pair}) won. Profit +$${pnl} credited.`);
      } else {
        const lost = round2(cp.amount * (signal.loss_pct / 100));
        const remain = round2(cp.amount - lost);
        pnl = -lost;

        db.prepare('UPDATE users SET balance = balance + ?, locked = locked - ? WHERE id = ?')
          .run(remain, cp.amount, cp.user_id);

        db.prepare(
          "INSERT INTO transactions (user_id, type, amount, status, meta) VALUES (?, 'copy_loss', ?, 'completed', ?)"
        ).run(cp.user_id, pnl, JSON.stringify({ signal_code: signal.code, pair: signal.pair, lost }));

        notify(db, cp.user_id, 'Copy Trade Lost', `Signal ${signal.code} (${signal.pair}) lost. -$${lost} deducted.`);
      }

      db.prepare("UPDATE copy_trades SET status = 'completed', pnl = ?, commission = ?, completed_at = ? WHERE id = ?")
        .run(pnl, commission, now, cp.id);
    }

    const message = `Signal ${signal.code} resolved as ${signal.outcome === 'win' ? 'WIN' : 'LOSS'} at ${signal.return_pct}% / ${signal.loss_pct}%`;
    db.prepare("UPDATE signals SET status = 'completed', completed_at = ?, result_message = ? WHERE id = ?")
      .run(now, message, signal.id);

    db.exec('COMMIT');
    broadcast('signal_update', { id: signal.id, status: 'completed', result_message: message });
    for (const cp of copies) sendToUser(cp.user_id, 'notification', { title: 'Signal Complete', message });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function processSignals() {
  const now = Date.now();
  const due = db
    .prepare("SELECT * FROM signals WHERE status = 'active' AND completes_at <= ?")
    .all(new Date(now).toISOString());
  for (const s of due) {
    try {
      resolveSignal(s);
    } catch (e) {
      console.error('resolveSignal failed', e);
    }
  }
}
