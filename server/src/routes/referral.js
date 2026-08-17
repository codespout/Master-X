import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { ok, publicSettings } from '../utils.js';
import { requireAuth } from '../middleware.js';
import { RANKS, rankForRefs, nextRank, rankShare } from '../ranks.js';
import { successfulRefCount } from '../copyEngine.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const refs = successfulRefCount(req.user.id);
  const rank = rankForRefs(refs);
  const next = nextRank(rank);

  const ranks = RANKS.map((r) => ({
    ...r,
    depositShare: rankShare(r.code, 'deposit'),
    profitShare: rankShare(r.code, 'profit')
  }));

  const referrals = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.total_deposited, u.created_at, r.bonus_paid,
              (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id AND t.type = 'deposit' AND t.status = 'completed') AS deposit_count
       FROM referrals r JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = ? ORDER BY r.id DESC`
    )
    .all(req.user.id);

  const myCommissions = db
    .prepare("SELECT id, amount, meta, created_at FROM transactions WHERE user_id = ? AND type = 'commission' ORDER BY id DESC LIMIT 50")
    .all(req.user.id);

  const totalCommission = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id = ? AND type = 'commission'")
    .get(req.user.id).s;

  const link = `${req.protocol}://${req.get('host')}/register?ref=${req.user.referral_code}`;

  return ok(res, {
    referral_code: req.user.referral_code,
    link,
    refs,
    rank: {
      ...rank,
      depositShare: rankShare(rank.code, 'deposit'),
      profitShare: rankShare(rank.code, 'profit')
    },
    next_rank: next,
    ranks,
    referrals,
    my_commissions: myCommissions,
    total_commission: Number(totalCommission),
    settings: publicSettings(getSettings())
  });
});

export default router;
