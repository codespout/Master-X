import crypto from 'node:crypto';
import { getSettings } from './db.js';

export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(res, message, status = 400, code = null) {
  return res.status(status).json({ ok: false, error: message, code });
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 8) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function randomRefCode() {
  return 'MX' + randomCode(6);
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function nowSql() {
  return new Date().toISOString();
}

export function addSecondsSql(secs) {
  return new Date(Date.now() + secs * 1000).toISOString();
}

export function isPast(isoDate) {
  if (!isoDate) return false;
  return Date.parse(isoDate) <= Date.now();
}

export function publicUser(u, settings = null) {
  if (!u) return null;
  const s = settings || getSettings();
  const base = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    kyc_status: u.kyc_status,
    kyc_message: u.kyc_message,
    kyc_submitted_at: u.kyc_submitted_at,
    kyc_reviewed_at: u.kyc_reviewed_at,
    payout_address: u.payout_address,
    payout_network: u.payout_network,
    referral_code: u.referral_code,
    referred_by: u.referred_by,
    telegram_id: u.telegram_id,
    totp_enabled: !!u.totp_enabled,
    balance: Number(u.balance),
    locked: Number(u.locked),
    total_deposited: Number(u.total_deposited),
    total_withdrawn: Number(u.total_withdrawn),
    total_profit: Number(u.total_profit),
    created_at: u.created_at
  };
  base.grace = graceInfo(u, s);
  return base;
}

export function graceInfo(u, settings = null) {
  const s = settings || getSettings();
  if (u.role === 'admin') return { active: false, ends_at: null, days_left: 0, total_days: 0 };
  const graceDays = Math.max(0, Number(s.withdrawal_grace_days) || 0);

  const hasExplicit = !!u.grace_ends_at;
  const explicit = hasExplicit ? Date.parse(u.grace_ends_at) : null;
  const now = Date.now();

  // Explicit admin override (grace_ends_at set) takes full control:
  // a past date marks the user as exempt, otherwise use the override date.
  if (hasExplicit) {
    const active = explicit > now;
    return {
      active,
      ends_at: active ? new Date(explicit).toISOString() : null,
      days_left: active ? Math.max(1, Math.ceil((explicit - now) / 86400000)) : 0,
      total_days: active ? Math.max(1, Math.ceil((explicit - Date.parse(u.created_at)) / 86400000)) : 0
    };
  }

  // No override: apply the platform default from account creation.
  const defaultEnd = graceDays > 0 && u.created_at ? Date.parse(u.created_at) + graceDays * 86400000 : null;
  const endMs = defaultEnd || 0;
  if (!endMs || endMs <= now) {
    return { active: false, ends_at: null, days_left: 0, total_days: graceDays };
  }
  return {
    active: true,
    ends_at: new Date(endMs).toISOString(),
    days_left: Math.max(1, Math.ceil((endMs - now) / 86400000)),
    total_days: graceDays
  };
}

export function publicSettings(s) {
  return {
    deposit_address: s.deposit_address,
    deposit_network: s.deposit_network,
    min_deposit: Number(s.min_deposit),
    max_deposit: Number(s.max_deposit),
    min_withdrawal: Number(s.min_withdrawal),
    max_withdrawal: Number(s.max_withdrawal),
    withdrawal_fee_pct: Number(s.withdrawal_fee_pct),
    withdrawal_tax_pct: Number(s.withdrawal_tax_pct),
    withdrawal_grace_days: Number(s.withdrawal_grace_days),
    referral_bonus_pct: Number(s.referral_bonus_pct),
    referral_min_first_deposit: Number(s.referral_min_first_deposit),
    code_valid_secs: Number(s.code_valid_secs),
    master_commission_pct: Number(s.master_commission_pct),
    binary_min_amount: Number(s.binary_min_amount),
    binary_max_amount: Number(s.binary_max_amount),
    binary_payout_pct: Number(s.binary_payout_pct),
    binary_expiries: String(s.binary_expiries || '60,300,900,1800,3600')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => x > 0),
    max_open_binary_trades: Number(s.max_open_binary_trades),
    max_open_copy_trades: Number(s.max_open_copy_trades),
    enable_binary: s.enable_binary === 'true',
    enable_copy: s.enable_copy === 'true',
    enable_referrals: s.enable_referrals === 'true',
    kyc_required: s.kyc_required === 'true',
    allow_signup: s.allow_signup === 'true',
    telegram_link: s.telegram_link,
    contact_email: s.contact_email
  };
}

export function jsonGet(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function notify(db, userId, title, message) {
  db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(
    userId,
    title,
    message
  );
}

export function creditBalance(db, userId, amount) {
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(Number(amount), userId);
}

export function debitBalance(db, userId, amount) {
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(Number(amount), userId);
}
