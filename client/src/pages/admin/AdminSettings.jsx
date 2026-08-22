import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Card, CardHeader, Button, Input, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

const RANKS = [
  { code: 'BR', name: 'Beginner', minRefs: 0, color: '#94a3b8' },
  { code: 'JR', name: 'Junior Trader', minRefs: 10, color: '#22c55e' },
  { code: 'SR', name: 'Senior Trader', minRefs: 25, color: '#38bdf8' },
  { code: 'EL', name: 'Elite Trader', minRefs: 50, color: '#a855f7' },
  { code: 'MT', name: 'Master Tier', minRefs: 100, color: '#f59e0b' }
];

function Section({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-mx-text">{title}</div>
        {subtitle && <div className="text-xs text-mx-muted">{subtitle}</div>}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-mx-muted">{label}</label>
      {children}
      {hint && <div className="mt-0.5 text-[10px] text-mx-muted">{hint}</div>}
    </div>
  );
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-mx-border bg-mx-card px-3 py-2.5">
      <div>
        <div className="text-xs font-semibold text-mx-text">{label}</div>
        {hint && <div className="text-[10px] text-mx-muted">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(value === 'true' ? 'false' : 'true')}
        className={`relative h-6 w-11 rounded-full transition-colors ${value === 'true' ? 'bg-mx-up' : 'bg-mx-border2'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value === 'true' ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [shares, setShares] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings').then((s) => {
      setSettings(s);
      try {
        setShares(JSON.parse(s.rank_shares || '{}'));
      } catch {
        setShares({});
      }
    }).catch(() => {});
  }, []);

  if (!settings) return null;

  const set = (k) => (e) => setSettings((s) => ({ ...s, [k]: (e && e.target ? e.target.value : e) }));
  const setShare = (code, kind) => (e) =>
    setShares((sh) => ({ ...sh, [code]: { ...(sh[code] || {}), [kind]: e.target.value } }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api.put('/api/admin/settings', { ...settings, rank_shares: JSON.stringify(shares) });
      setSettings(s);
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Platform Settings" subtitle="Full control over users, trades, referrals and features" />
      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title="Financial Limits" subtitle="Deposit & withdrawal bounds applied across the platform" />
          <div className="space-y-4 p-4">
            <Section title="Deposits" subtitle="Manual deposit request bounds">
              <Field label="Min deposit (USDT)"><Input type="number" value={settings.min_deposit} onChange={set('min_deposit')} /></Field>
              <Field label="Max deposit (USDT)"><Input type="number" value={settings.max_deposit} onChange={set('max_deposit')} /></Field>
              <Field label="Deposit address"><Input value={settings.deposit_address} onChange={set('deposit_address')} className="font-mono text-xs" /></Field>
              <Field label="Deposit network"><Input value={settings.deposit_network} onChange={set('deposit_network')} /></Field>
            </Section>
            <Section title="Withdrawals" subtitle="Fees & tax are deducted before payout">
              <Field label="Min withdrawal (USDT)"><Input type="number" value={settings.min_withdrawal} onChange={set('min_withdrawal')} /></Field>
              <Field label="Max withdrawal (USDT)"><Input type="number" value={settings.max_withdrawal} onChange={set('max_withdrawal')} /></Field>
              <Field label="Fee (%)"><Input type="number" value={settings.withdrawal_fee_pct} onChange={set('withdrawal_fee_pct')} /></Field>
              <Field label="Tax (%)"><Input type="number" value={settings.withdrawal_tax_pct} onChange={set('withdrawal_tax_pct')} /></Field>
            </Section>
            <Section title="Hold (grace) period" subtitle="Days after signup before a user can withdraw — 0 disables">
              <Field label="Grace period (days)" hint="Applied from account creation; admins can extend per user">
                <Input type="number" min={0} value={settings.withdrawal_grace_days} onChange={set('withdrawal_grace_days')} />
              </Field>
            </Section>
          </div>
        </Card>

        <Card>
          <CardHeader title="Referral & Ranks" subtitle="Percentages per promoted rank — referral bonus is a percentage of first deposit" />
          <div className="space-y-4 p-4">
            <Section title="Referral rules" subtitle="Applied to all ranks">
              <Field label="Referral bonus (% of first deposit)">
                <Input type="number" value={settings.referral_bonus_pct} onChange={set('referral_bonus_pct')} />
              </Field>
              <Field label="Min first deposit for bonus (USDT)">
                <Input type="number" value={settings.referral_min_first_deposit} onChange={set('referral_min_first_deposit')} />
              </Field>
            </Section>
            <div>
              <div className="mb-2 text-sm font-semibold text-mx-text">Rank profit / deposit shares</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {RANKS.map((r) => {
                  const sh = shares[r.code] || {};
                  return (
                    <div key={r.code} className="rounded-xl border border-mx-border bg-mx-card p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: r.color }}>{r.name}</span>
                        <span className="text-[10px] text-mx-muted">{r.minRefs}+ refs</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-mx-muted">
                          <span>Deposit share %</span>
                          <span className="font-mono text-mx-up">{sh.deposit || 0}%</span>
                        </div>
                        <Input type="number" min={0} max={100} value={sh.deposit ?? 0} onChange={setShare(r.code, 'deposit')} />
                        <div className="flex items-center justify-between text-[10px] text-mx-muted">
                          <span>Profit share %</span>
                          <span className="font-mono text-mx-accent">{sh.profit || 0}%</span>
                        </div>
                        <Input type="number" min={0} max={100} value={sh.profit ?? 0} onChange={setShare(r.code, 'profit')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Binary Options Trading" subtitle="Fixed-time trading controls" />
          <div className="space-y-4 p-4">
            <Section title="Trade limits">
              <Field label="Min investment (USDT)"><Input type="number" value={settings.binary_min_amount} onChange={set('binary_min_amount')} /></Field>
              <Field label="Max investment (USDT)"><Input type="number" value={settings.binary_max_amount} onChange={set('binary_max_amount')} /></Field>
              <Field label="Payout on win (%)"><Input type="number" value={settings.binary_payout_pct} onChange={set('binary_payout_pct')} /></Field>
              <Field label="Max concurrent open trades"><Input type="number" value={settings.max_open_binary_trades} onChange={set('max_open_binary_trades')} /></Field>
            </Section>
            <Section title="Expiries" subtitle="Comma-separated durations in seconds shown to traders">
              <Field label="Available expiries (s)"><Input value={settings.binary_expiries} onChange={set('binary_expiries')} /></Field>
            </Section>
          </div>
        </Card>

        <Card>
          <CardHeader title="Copy Trading (Master)" subtitle="Code-drop controls and master commission" />
          <div className="space-y-4 p-4">
            <Section title="Signal defaults">
              <Field label="Code validity (s)"><Input type="number" value={settings.code_valid_secs} onChange={set('code_valid_secs')} /></Field>
              <Field label="Default trade duration (s)"><Input type="number" value={settings.default_duration_secs} onChange={set('default_duration_secs')} /></Field>
              <Field label="Default return (%)"><Input type="number" value={settings.default_return_pct} onChange={set('default_return_pct')} /></Field>
              <Field label="Master commission (%)"><Input type="number" value={settings.master_commission_pct} onChange={set('master_commission_pct')} /></Field>
            </Section>
            <Section title="Copier limits">
              <Field label="Max concurrent copy trades per user"><Input type="number" value={settings.max_open_copy_trades} onChange={set('max_open_copy_trades')} /></Field>
            </Section>
          </div>
        </Card>

        <Card>
          <CardHeader title="Features & Access" subtitle="Toggle platform capabilities" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Toggle value={settings.allow_signup} onChange={set('allow_signup')} label="Open registrations" hint="Allow new user signups" />
            <Toggle value={settings.enable_binary} onChange={set('enable_binary')} label="Binary options trading" hint="Enable the fixed-time trading module" />
            <Toggle value={settings.enable_copy} onChange={set('enable_copy')} label="Copy trading" hint="Enable Master code-drop copying" />
            <Toggle value={settings.enable_referrals} onChange={set('enable_referrals')} label="Referral program" hint="Enable referrals & commissions" />
            <Toggle value={settings.kyc_required} onChange={set('kyc_required')} label="KYC required to trade" hint="Block trading until identity verified" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Contact & Integration" subtitle="Shown to users" />
          <div className="space-y-4 p-4">
            <Section title="Links">
              <Field label="Telegram channel"><Input value={settings.telegram_link} onChange={set('telegram_link')} /></Field>
              <Field label="Support email"><Input value={settings.contact_email} onChange={set('contact_email')} /></Field>
            </Section>
          </div>
        </Card>

        <Card>
          <CardHeader title="Security" subtitle="Account security enforcement across the platform" />
          <div className="space-y-4 p-4">
            <Section title="Login protection" subtitle="Applied at sign-in">
              <Field label="Min password length"><Input type="number" min={6} value={settings.min_password_length} onChange={set('min_password_length')} /></Field>
              <Field label="Max login attempts"><Input type="number" min={1} value={settings.max_login_attempts} onChange={set('max_login_attempts')} /></Field>
              <Field label="Lockout after attempts (min)"><Input type="number" min={1} value={settings.login_lockout_minutes} onChange={set('login_lockout_minutes')} /></Field>
              <Field label="Session timeout (min)"><Input type="number" min={5} value={settings.session_timeout_minutes} onChange={set('session_timeout_minutes')} /></Field>
            </Section>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Toggle value={settings.require_admin_2fa} onChange={set('require_admin_2fa')} label="Require 2FA for admins" hint="Admin logins must have 2FA configured" />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="px-8">
            {busy ? <Spinner /> : null} Save All Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
