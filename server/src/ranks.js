import { getSetting } from './db.js';

export const RANKS = [
  { code: 'BR', name: 'Beginner', minRefs: 0, color: '#94a3b8' },
  { code: 'JR', name: 'Junior Trader', minRefs: 10, color: '#22c55e' },
  { code: 'SR', name: 'Senior Trader', minRefs: 25, color: '#38bdf8' },
  { code: 'EL', name: 'Elite Trader', minRefs: 50, color: '#a855f7' },
  { code: 'MT', name: 'Master Tier', minRefs: 100, color: '#f59e0b' }
];

const FALLBACK_SHARES = {
  BR: { deposit: 5, profit: 1 },
  JR: { deposit: 7, profit: 2 },
  SR: { deposit: 9, profit: 3 },
  EL: { deposit: 12, profit: 5 },
  MT: { deposit: 15, profit: 8 }
};

export function getRankShares() {
  const raw = getSetting('rank_shares', null);
  if (!raw) return FALLBACK_SHARES;
  try {
    const parsed = JSON.parse(raw);
    return { ...FALLBACK_SHARES, ...parsed };
  } catch {
    return FALLBACK_SHARES;
  }
}

export function rankShare(code, kind) {
  const shares = getRankShares()[code] || {};
  const fallback = (FALLBACK_SHARES[code] || {})[kind] || (kind === 'deposit' ? 5 : 1);
  const v = Number(shares[kind]);
  return Number.isFinite(v) ? v : fallback;
}

export function rankForRefs(count) {
  let rank = RANKS[0];
  for (const r of RANKS) if (count >= r.minRefs) rank = r;
  return rank;
}

export function nextRank(rank) {
  const idx = RANKS.findIndex((r) => r.code === rank.code);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}
