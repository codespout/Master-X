import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, getSetting } from '../db.js';
import { ok, fail, publicUser, randomRefCode, notify } from '../utils.js';
import { requireAuth, signToken } from '../middleware.js';
import { verifyTotp } from '../totp.js';

const router = Router();

const loginAttempts = new Map();

function getMinPasswordLength() {
  return Math.max(6, Number(getSetting('min_password_length', '8')) || 8);
}

function passwordIssues(pw) {
  const issues = [];
  const s = String(pw || '');
  if (s.length < getMinPasswordLength()) issues.push(`at least ${getMinPasswordLength()} characters`);
  if (!/[a-z]/.test(s)) issues.push('a lowercase letter');
  if (!/[A-Z]/.test(s)) issues.push('an uppercase letter');
  if (!/\d/.test(s)) issues.push('a number');
  if (s.length > 128) issues.push('no more than 128 characters');
  return issues;
}

function checkLockout(email) {
  const entry = loginAttempts.get(email);
  if (!entry) return null;
  const maxAttempts = Number(getSetting('max_login_attempts', '5')) || 5;
  const lockoutMins = Number(getSetting('login_lockout_minutes', '15')) || 15;
  if (entry.count >= maxAttempts) {
    const lockUntil = entry.lockUntil;
    if (lockUntil > Date.now()) {
      const mins = Math.ceil((lockUntil - Date.now()) / 60000);
      return `Too many failed attempts. Try again in ${mins} min.`;
    }
    loginAttempts.delete(email);
  }
  return null;
}

function recordFailedLogin(email) {
  const entry = loginAttempts.get(email) || { count: 0, lockUntil: 0 };
  entry.count += 1;
  const maxAttempts = Number(getSetting('max_login_attempts', '5')) || 5;
  if (entry.count >= maxAttempts) {
    entry.lockUntil = Date.now() + (Number(getSetting('login_lockout_minutes', '15')) || 15) * 60000;
  }
  loginAttempts.set(email, entry);
}

router.post('/register', (req, res) => {
  if (getSetting('allow_signup', 'true') !== 'true') {
    return fail(res, 'New registrations are currently disabled by the platform');
  }
  const { name, email, password, referral_code, telegram_id } = req.body || {};
  if (!name || !email || !password) return fail(res, 'Name, email and password are required');
  const issues = passwordIssues(password);
  if (issues.length) return fail(res, `Password must include ${issues.join(', ')}.`);
  const emailNorm = String(email).trim().toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
  if (exists) return fail(res, 'An account with this email already exists. Try signing in instead.');

  let referredBy = null;
  if (referral_code) {
    const ref = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(referral_code).trim().toUpperCase());
    if (ref) referredBy = ref.id;
  }

  let code = randomRefCode();
  while (db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code)) code = randomRefCode();

  const hash = bcrypt.hashSync(String(password), 10);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, referral_code, referred_by, telegram_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(emailNorm, hash, String(name).trim(), code, referredBy, telegram_id ? String(telegram_id).trim() : null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  if (referredBy) {
    db.prepare('INSERT OR IGNORE INTO referrals (referrer_id, referred_id) VALUES (?, ?)').run(referredBy, user.id);
  }

  const token = signToken(user);
  return ok(res, { token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password, totp } = req.body || {};
  if (!email || !password) return fail(res, 'Email and password are required');
  const emailNorm = String(email).trim().toLowerCase();

  const locked = checkLockout(emailNorm);
  if (locked) return fail(res, locked, 429);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm);
  if (!user) {
    recordFailedLogin(emailNorm);
    return fail(res, 'No account found with this email. Check the spelling or create a new account.', 401);
  }
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    recordFailedLogin(emailNorm);
    return fail(res, 'Incorrect password. Passwords are case-sensitive — check your caps lock.', 401);
  }

  if (user.status === 'banned') return fail(res, 'Account suspended', 403);

  if (user.totp_enabled) {
    if (!totp || !verifyTotp(user.totp_secret, totp)) {
      return fail(res, 'Two-factor code required', 401, '2FA_REQUIRED');
    }
  } else if (user.role === 'admin' && getSetting('require_admin_2fa', 'false') === 'true') {
    return fail(res, 'Admin two-factor authentication must be enabled. Sign in from a browser to set it up.', 401, '2FA_SETUP_REQUIRED');
  }

  loginAttempts.delete(emailNorm);
  const token = signToken(user);
  return ok(res, { token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  return ok(res, publicUser(req.user));
});

router.put('/profile', requireAuth, (req, res) => {
  const { name, payout_address, payout_network, telegram_id } = req.body || {};
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.user.id);
  if (payout_address !== undefined) db.prepare('UPDATE users SET payout_address = ? WHERE id = ?').run(String(payout_address).trim(), req.user.id);
  if (payout_network !== undefined) db.prepare('UPDATE users SET payout_network = ? WHERE id = ?').run(String(payout_network).trim(), req.user.id);
  if (telegram_id !== undefined) db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(telegram_id ? String(telegram_id).trim() : null, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return ok(res, publicUser(user));
});

router.get('/notifications', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  return ok(res, rows);
});

router.post('/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  return ok(res, { read: true });
});

router.post('/logout', (req, res) => ok(res, { loggedOut: true }));

export default router;
