import { useEffect, useState } from 'react';
import { ShieldCheck, ImageUp, Wallet, Save, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Card, CardHeader, Badge, Button, Input, toast, Spinner } from '../components/ui';

const KYC_STATUS = {
  none: { label: 'Not submitted', icon: Clock, color: 'text-mx-muted', badge: 'none' },
  pending: { label: 'Under review', icon: Clock, color: 'text-amber-400', badge: 'pending' },
  approved: { label: 'Verified', icon: CheckCircle2, color: 'text-mx-up', badge: 'approved' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-rose-400', badge: 'rejected' }
};

export default function KycProfile() {
  const { user, setUser, refresh } = useAuth();
  const [kyc, setKyc] = useState(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(user.name);
  const [payoutAddress, setPayoutAddress] = useState(user.payout_address || '');
  const [payoutNetwork, setPayoutNetwork] = useState(user.payout_network || 'USDT-TRC20');
  const [telegramId, setTelegramId] = useState(user.telegram_id || '');
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    api.get('/api/kyc/status').then(setKyc).catch(() => {});
  }, [user.kyc_status]);

  const st = KYC_STATUS[kyc?.status || user.kyc_status] || KYC_STATUS.none;
  const StatusIcon = st.icon;

  const submitKyc = async (e) => {
    e.preventDefault();
    if (files.length === 0) return toast('Upload at least one identity document');
    const fd = new FormData();
    files.forEach((f) => fd.append('documents', f));
    setBusy(true);
    try {
      const u = await api.upload('/api/kyc/upload', fd);
      setUser(u);
      toast('Documents submitted for review', 'success');
      setFiles([]);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaveBusy(true);
    try {
      const u = await api.put('/api/auth/profile', { name, payout_address: payoutAddress, payout_network: payoutNetwork, telegram_id: telegramId });
      setUser(u);
      toast('Profile updated', 'success');
      refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">KYC & Profile</h1>
        <p className="text-sm text-mx-muted">Identity verification and payout settings.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identity Verification" subtitle="Required before trading" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4 rounded-xl border border-mx-border bg-mx-bg2 p-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${st.color} bg-white/5`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-mx-text">KYC Status</div>
                <div className="mt-1"><Badge status={st.badge}>{st.label}</Badge></div>
              </div>
              {user.kyc_status === 'pending' && (
                <div className="ml-auto text-xs text-mx-muted">
                  Submitted {kyc?.submitted_at ? new Date(kyc.submitted_at.replace(' ', 'T') + 'Z').toLocaleDateString() : ''}
                </div>
              )}
            </div>

            {user.kyc_status === 'approved' && (
              <div className="flex items-start gap-2 rounded-xl border border-mx-up/30 bg-mx-up/5 p-4 text-sm text-mx-up">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Your identity is verified. Full platform access enabled.
              </div>
            )}

            {user.kyc_status === 'rejected' && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
                <p className="font-semibold">Documents rejected</p>
                <p className="mt-1 text-rose-300/80">{user.kyc_message || 'Please resubmit valid documents.'}</p>
              </div>
            )}

            {user.kyc_status !== 'approved' && (
              <form onSubmit={submitKyc} className="space-y-4">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-mx-border2 bg-mx-bg2 p-6 text-center hover:border-mx-accent/50">
                  <ImageUp className="h-8 w-8 text-mx-accent" />
                  <span className="text-sm font-medium text-mx-text">Upload identity documents</span>
                  <span className="text-xs text-mx-muted">Passport, ID card or driver's license (up to 3 images)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-mx-border bg-mx-bg2 px-3 py-2 text-xs text-mx-text">
                        <span className="truncate">{f.name}</span>
                        <span className="ml-2 shrink-0 text-mx-muted">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="submit" disabled={busy || files.length === 0} className="w-full">
                  {busy ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} Submit for Review
                </Button>
              </form>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payout Settings" subtitle="Where withdrawals are sent" />
          <form onSubmit={saveProfile} className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Display name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Network</label>
              <Input value={payoutNetwork} onChange={(e) => setPayoutNetwork(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Payout wallet address</label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
                <Input value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} placeholder="Enter your wallet address" className="pl-10 font-mono text-xs" />
              </div>
              <p className="mt-1 text-[11px] text-mx-muted">Withdrawals are paid to this address after admin fulfillment.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Telegram ID (optional)</label>
              <div className="relative">
                <Send className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
                <Input value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="@username" className="pl-10" />
              </div>
              <p className="mt-1 text-[11px] text-mx-muted">Used for signals and support notifications.</p>
            </div>
            <Button type="submit" disabled={saveBusy} variant="ghost" className="w-full">
              {saveBusy ? <Spinner /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
