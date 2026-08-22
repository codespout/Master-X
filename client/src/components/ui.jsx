import { useEffect, useMemo, useState } from 'react';

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-mx-border bg-mx-card ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between border-b border-mx-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-mx-text">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-mx-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  active: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  fulfilled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  open: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  closed: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  liquidated: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  expired: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  banned: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  none: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  win: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  loss: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  approved_rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
};

export function Badge({ status, children }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.none;
  const label = children || (status ? status.charAt(0).toUpperCase() + status.slice(1) : status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${style}`}>
      {label}
    </span>
  );
}

export function PnlText({ value, digits = 2 }) {
  const v = Number(value || 0);
  const cls = v > 0 ? 'text-mx-up' : v < 0 ? 'text-mx-down' : 'text-mx-muted';
  const sign = v > 0 ? '+' : '';
  return (
    <span className={`font-mono font-semibold ${cls}`}>
      {sign}
      {v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </span>
  );
}

export function Stat({ label, value, sub, accent = 'text-mx-text' }) {
  return (
    <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4">
      <p className="text-xs font-medium text-mx-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-mx-muted">{sub}</p>}
    </div>
  );
}

export function Countdown({ targetMs, onEnd, className = '', label = '' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, targetMs - now);
  useEffect(() => {
    if (remaining === 0 && onEnd) onEnd();
  }, [remaining, onEnd]);

  const fmt = useMemo(() => {
    const totalSecs = Math.floor(remaining / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const ms = String(Math.floor((remaining % 1000) / 100)).padStart(1, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}.${ms}`;
  }, [remaining]);

  return (
    <span className={`font-mono font-bold tabular-nums ${remaining <= 5000 ? 'text-mx-down' : 'text-mx-accent'} ${className}`}>
      {label && <span className="text-mx-muted">{label} </span>}
      {fmt}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} fade-in rounded-2xl border border-mx-border2 bg-mx-card p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-mx-text">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-mx-muted hover:bg-mx-bg2 hover:text-mx-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-mx-border bg-mx-bg2 px-3.5 py-2.5 text-sm text-mx-text placeholder:text-mx-muted/60 focus:border-mx-accent focus:outline-none focus:ring-1 focus:ring-mx-accent/40 ${props.className || ''}`}
    />
  );
}

export function PasswordInput({ className = '', icon, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {icon}
      <Input
        {...rest}
        type={show ? 'text' : 'password'}
        className={`${icon ? 'pl-10' : ''} pr-10 ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-mx-muted hover:bg-mx-bg2 hover:text-mx-accent"
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="m1 1 22 22" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-mx-border bg-mx-bg2 px-3.5 py-2.5 text-sm text-mx-text focus:border-mx-accent focus:outline-none focus:ring-1 focus:ring-mx-accent/40 ${props.className || ''}`}
    />
  );
}

export function Button({ variant = 'primary', className = '', children, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-mx-accent text-slate-950 hover:bg-sky-400',
    success: 'bg-mx-up text-slate-950 hover:bg-green-400',
    danger: 'bg-mx-down text-white hover:bg-rose-500',
    ghost: 'border border-mx-border2 bg-mx-bg2 text-mx-text hover:border-mx-accent/50 hover:text-mx-accent',
    outline: 'border border-mx-border2 bg-transparent text-mx-text hover:bg-mx-bg2'
  };
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function toast(msg, kind = 'error') {
  window.dispatchEvent(new CustomEvent('mx-toast', { detail: { msg, kind } }));
}
