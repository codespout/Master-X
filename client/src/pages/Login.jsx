import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, Mail, Lock, User as UserIcon, Gift, ShieldCheck, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, setToken } from '../api';
import { connect } from '../ws';
import { Button, Input, PasswordInput, toast, Spinner } from '../components/ui';

function Shell({ children, subtitle }) {
  return (
    <div className="flex min-h-screen bg-mx-bg bg-grid">
      <div className="m-auto flex w-full max-w-md flex-col px-4">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mx-accent/15 text-mx-accent">
            <Zap className="h-7 w-7" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-white">
              MASTER<span className="text-mx-accent">X</span>
            </div>
            <div className="text-[11px] font-medium tracking-widest text-mx-muted">{subtitle}</div>
          </div>
        </div>
        <div className="fade-in rounded-2xl border border-mx-border2 bg-mx-card p-6 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}

function FormError({ children }) {
  if (!children) return null;
  return (
    <div className="fade-in flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function PasswordStrength({ password, minLen = 8 }) {
  const score = useMemo(() => {
    let s = 0;
    if (!password) return 0;
    if (password.length >= minLen) s += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s += 1;
    if (/\d/.test(password)) s += 1;
    if (/[^a-zA-Z0-9]/.test(password)) s += 1;
    return s;
  }, [password, minLen]);
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = ['bg-rose-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500', 'bg-emerald-400'];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score - 1] : 'bg-mx-border2'}`} />
        ))}
      </div>
      <div className={`mt-1 text-[11px] font-medium ${score >= 3 ? 'text-mx-up' : score >= 2 ? 'text-amber-400' : 'text-rose-400'}`}>
        {labels[score]}
      </div>
    </div>
  );
}

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post('/api/auth/login', { email, password, totp: totp || undefined });
      setToken(data.token);
      setUser(data.user);
      connect();
      toast('Welcome back to MASTER X', 'success');
      navigate('/');
    } catch (err) {
      if (err.code === '2FA_REQUIRED') {
        setNeedsTotp(true);
        toast('Enter your two-factor authentication code');
      } else {
        setError(err.message);
        toast(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell subtitle="FUTURES & COPY TRADING">
      <h1 className="text-lg font-bold text-mx-text">Sign in to your account</h1>
      <p className="mt-1 text-sm text-mx-muted">Access your dashboard and live signal room.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormError>{error}</FormError>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="you@email.com" className="pl-10" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Password</label>
          <PasswordInput
            required
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••"
            icon={<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />}
          />
        </div>
        {needsTotp && (
          <div className="fade-in">
            <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Two-factor code</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-accent" />
              <Input
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="pl-10 font-mono tracking-widest"
                autoFocus
              />
            </div>
          </div>
        )}
        <Button type="submit" disabled={busy} className="w-full py-3">
          {busy && <Spinner />} {needsTotp ? 'Verify & Sign In' : 'Sign In'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-mx-muted">
        No account?{' '}
        <Link to="/register" className="font-semibold text-mx-accent hover:underline">
          Create one
        </Link>
      </p>
    </Shell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    telegram_id: '',
    referral_code: params.get('ref') || ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post('/api/auth/register', form);
      setToken(data.token);
      setSuccess(true);
      toast('Account created — welcome to MASTER X', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 700);
    } catch (err) {
      setError(err.message);
      toast(err.message);
      setBusy(false);
    }
  };

  return (
    <Shell subtitle="FUTURES & COPY TRADING">
      <h1 className="text-lg font-bold text-mx-text">Create your account</h1>
      <p className="mt-1 text-sm text-mx-muted">Join the Master signal room in seconds.</p>
      {success && (
        <div className="fade-in mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Account created successfully. Redirecting to your dashboard…
        </div>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormError>{error}</FormError>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Full name</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input required value={form.name} onChange={set('name')} placeholder="John Carter" className="pl-10" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input type="email" required value={form.email} onChange={set('email')} placeholder="you@email.com" className="pl-10" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Password</label>
          <PasswordInput
            required
            value={form.password}
            onChange={set('password')}
            placeholder="Min. 8 characters"
            icon={<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />}
          />
          <PasswordStrength password={form.password} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">
            Telegram ID <span className="font-normal text-mx-muted">(optional)</span>
          </label>
          <div className="relative">
            <Send className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input value={form.telegram_id} onChange={set('telegram_id')} placeholder="@username" className="pl-10" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Referral code (optional)</label>
          <div className="relative">
            <Gift className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input value={form.referral_code} onChange={set('referral_code')} placeholder="MX••••••" className="pl-10 uppercase" />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full py-3">
          {busy && <Spinner />} Create Account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-mx-muted">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-mx-accent hover:underline">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
