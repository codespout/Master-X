import { Router } from 'express';
import { db } from '../db.js';
import { ok, fail, publicUser, nowSql, notify } from '../utils.js';
import { requireAuth, upload } from '../middleware.js';
import { sendToUser } from '../ws.js';

const router = Router();

router.get('/status', requireAuth, (req, res) => {
  return ok(res, {
    status: req.user.kyc_status,
    message: req.user.kyc_message,
    submitted_at: req.user.kyc_submitted_at,
    documents: req.user.kyc_docs ? JSON.parse(req.user.kyc_docs) : []
  });
});

router.post('/upload', requireAuth, upload.array('documents', 3), (req, res) => {
  if (req.user.kyc_status === 'pending') return fail(res, 'Your KYC is already under review');
  if (req.user.kyc_status === 'approved') return fail(res, 'Your identity is already verified');
  if (!req.files || req.files.length === 0) return fail(res, 'Please upload at least one identity document');

  const paths = req.files.map((f) => `/uploads/${f.filename}`);
  db.prepare(
    "UPDATE users SET kyc_status = 'pending', kyc_docs = ?, kyc_message = NULL, kyc_submitted_at = ? WHERE id = ?"
  ).run(JSON.stringify(paths), nowSql(), req.user.id);

  notify(db, req.user.id, 'KYC Submitted', 'Your documents are under review. You will be notified once verified.');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return ok(res, publicUser(user));
});

export default router;
