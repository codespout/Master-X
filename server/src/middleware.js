import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { JWT_SECRET, UPLOAD_DIR } from './config.js';
import { db } from './db.js';
import { fail } from './utils.js';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

export function signToken(user, expiresIn) {
  if (!expiresIn) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'session_timeout_minutes'").get();
    const mins = Number((row && row.value) || '10080');
    expiresIn = `${Math.max(1, Number.isFinite(mins) ? mins : 10080)}m`;
  }
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Authentication required', 401);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return fail(res, 'User not found', 401);
    if (user.status === 'banned') return fail(res, 'Account suspended', 403);
    req.user = user;
    next();
  } catch {
    return fail(res, 'Invalid or expired token', 401);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return fail(res, 'Admin access required', 403);
  next();
}

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return fail(res, `Upload error: ${err.message}`, 400);
  }
  if (err.message && err.message.startsWith('Only image')) {
    return fail(res, err.message, 400);
  }
  console.error(err);
  return fail(res, err.message || 'Internal server error', 500);
}
