import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, getSetting } from '../db.js';
import { ok, fail, publicUser, notify } from '../utils.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { generateSecret, verifyTotp, otpauthUrl } from '../totp.js';

const router = Router();
router.use(requireAuth, requireAdmin);

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

router.put('/password', (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return fail(res, 'Current and new password are required');
  if (!bcrypt.compareSync(String(current_password), req.user.password_hash)) {
    return fail(res, 'Current password is incorrect');
  }
  const issues = passwordIssues(new_password);
  if (issues.length) return fail(res, `New password must include ${issues.join(', ')}.`);
  const hash = bcrypt.hashSync(String(new_password), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  notify(db, req.user.id, 'Password Changed', 'Your account password was changed successfully.');
  return ok(res, { changed: true });
});

router.get('/2fa/setup', (req, res) => {
  const secret = generateSecret();
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, req.user.id);
  return ok(res, { secret, otpauth_url: otpauthUrl(secret, req.user.email) });
});

router.post('/2fa/enable', (req, res) => {
  const { code } = req.body || {};
  const secret = req.user.totp_secret;
  if (!secret) return fail(res, 'Run setup first to generate a secret');
  if (!verifyTotp(secret, code)) return fail(res, 'Invalid verification code');
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.user.id);
  notify(db, req.user.id, '2FA Enabled', 'Two-factor authentication is now active on your account.');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return ok(res, publicUser(user));
});

router.post('/2fa/disable', (req, res) => {
  const { code } = req.body || {};
  if (!req.user.totp_secret) return fail(res, '2FA is not configured');
  if (!verifyTotp(req.user.totp_secret, code)) return fail(res, 'Invalid verification code');
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.user.id);
  notify(db, req.user.id, '2FA Disabled', 'Two-factor authentication was disabled on your account.');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return ok(res, publicUser(user));
});

export default router;
