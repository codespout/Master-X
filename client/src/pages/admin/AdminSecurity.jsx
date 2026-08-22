import { useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff, Lock, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { Card, CardHeader, Button, Input, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

export default function AdminSecurity() {
  const { user, refresh } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast('New password must be at least 8 characters');
    if (pw.next !== pw.confirm) return toast('Passwords do not match');
    setPwBusy(true);
    try {
      await api.put('/api/admin/security/password', { current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast('Password changed successfully', 'success');
    } catch (err) {
      toast(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const beginSetup = async () => {
    try {
      const s = await api.get('/api/admin/security/2fa/setup');
      setSetup(s);
    } catch (err) {
      toast(err.message);
    }
  };

  const enable2fa = async () => {
    if (!code || code.length !== 6) return toast('Enter the 6-digit code from your authenticator app');
    setBusy(true);
    try {
      await api.post('/api/admin/security/2fa/enable', { code });
      setSetup(null);
      setCode('');
      toast('Two-factor authentication enabled', 'success');
      refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    if (!code || code.length !== 6) return toast('Enter the 6-digit code to confirm');
    setBusy(true);
    try {
      await api.post('/api/admin/security/2fa/disable', { code });
      setCode('');
      toast('Two-factor authentication disabled', 'success');
      refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(setup.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Account Security" subtitle="Change your password and enable two-factor authentication" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Change Password" subtitle="Use a strong password you don't use elsewhere" />
          <form onSubmit={changePassword} className="space-y-3.5 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-mx-muted">Current password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
                <Input type="password" required value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className="pl-10" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-mx-muted">New password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
                <Input type="password" required minLength={8} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="Min. 8 characters" className="pl-10" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-mx-muted">Confirm new password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
                <Input type="password" required minLength={8} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className="pl-10" />
              </div>
            </div>
            <Button type="submit" disabled={pwBusy} className="w-full py-3">
              {pwBusy ? <Spinner /> : <KeyRound className="h-4 w-4" />} Update Password
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Two-Factor Authentication (2FA)" subtitle="Protect your admin account with an authenticator app" />
          <div className="space-y-4 p-5">
            {!user?.totp_enabled && !setup && (
              <div className="space-y-4">
                <p className="text-sm text-mx-muted">
                  2FA adds a second verification step at sign-in. You'll scan a QR code with Google Authenticator, Authy, or a similar app.
                </p>
                <Button onClick={beginSetup} variant="success" className="w-full py-3">
                  <ShieldCheck className="h-4 w-4" /> Enable 2FA
                </Button>
              </div>
            )}

            {user?.totp_enabled && (
              <div className="rounded-xl border border-mx-up/40 bg-mx-up/10 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-mx-up">
                  <ShieldCheck className="h-4 w-4" /> 2FA is enabled
                </div>
                <p className="mt-1 text-xs text-mx-muted">
                  Your account requires a verification code at every sign-in. To disable, enter a current code below.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className="font-mono tracking-widest" />
                  <Button variant="danger" onClick={disable2fa} disabled={busy} className="shrink-0">
                    {busy ? <Spinner /> : <ShieldOff className="h-4 w-4" />} Disable
                  </Button>
                </div>
              </div>
            )}

            {setup && (
              <div className="fade-in space-y-4">
                <div className="flex justify-center rounded-xl border border-mx-border bg-white p-4">
                  <QRCodeSVG value={setup.otpauth_url} size={180} level="M" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-mx-muted">Manual entry secret</label>
                  <div className="flex gap-2">
                    <Input readOnly value={setup.secret} className="font-mono tracking-widest" />
                    <Button variant="ghost" onClick={copySecret} className="shrink-0">
                      {copied ? <Check className="h-4 w-4 text-mx-up" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-mx-muted">Enter the 6-digit code from the app</label>
                  <div className="flex gap-2">
                    <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="font-mono tracking-widest" />
                    <Button variant="success" onClick={enable2fa} disabled={busy} className="shrink-0">
                      {busy ? <Spinner /> : 'Verify & Enable'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
