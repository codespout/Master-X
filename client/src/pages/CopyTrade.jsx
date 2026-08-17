import { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  KeyRound,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Lock,
  Eye,
  Timer,
  Wallet,
  Percent,
  BarChart3
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api, fmtMoney, fmtTime } from '../api';
import { subscribe } from '../ws';
import { Card, CardHeader, Badge, Button, Input, Countdown, PnlText, Modal, toast, Spinner } from '../components/ui';

function projectedPath(entry, target, points = 80) {
  const pts = [];
  for (let i = 0; i <= points; i++) {
    const f = i / points;
    const eased = f * f * (3 - 2 * f);
    const noise = Math.sin(f * Math.PI) * Math.sin(i * 2.3 + 1.7) * entry * 0.0016;
    pts.push({ t: i, price: entry + (target - entry) * eased + noise });
  }
  return pts;
}

function CopyTradeDetailModal({ signal, onClose }) {
  const myJoin = useMemo(
    () => signal.my_copies && signal.my_copies.find((c) => c.status === 'active'),
    [signal]
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);

  const amount = myJoin?.amount || 0;
  const gross = (amount * signal.return_pct) / 100;
  const commission = gross * (signal.commission_pct / 100);
  const net = gross - commission;

  const entry = myJoin?.entry_price || 0;
  const isWin = signal.outcome === 'win';
  const up = (signal.side === 'long') === isWin;
  const pct = isWin ? signal.return_pct : (signal.loss_pct ?? 100);
  const target = entry ? entry * (1 + ((up ? 1 : -1) * pct) / 100) : 0;

  const totalMs = signal.duration_secs * 1000;
  const startedAt = Date.parse(signal.starts_at || signal.created_at);
  const progress = Math.min(1, Math.max(0, (now - startedAt) / totalMs));
  const progressPct = Math.round(progress * 100);

  const chart = useMemo(() => projectedPath(entry, target), [entry, target]);
  const revealed = Math.max(2, Math.min(chart.length - 1, Math.floor(progress * chart.length)));
  const visible = chart.slice(0, revealed + 1);
  const currentProjected = visible[visible.length - 1]?.price || entry;

  const tooltipStyle = { background: '#0d1524', border: '1px solid #2a3b59', borderRadius: 12, fontSize: 11 };

  return (
    <Modal open onClose={onClose} title="Copy Trade — Live Tracking" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mx-border bg-mx-bg2 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${signal.side === 'long' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
              {signal.side === 'long' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-extrabold text-white">{signal.code}</span>
                <Badge status={signal.side}>{signal.side}</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold text-sky-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" /> LIVE · IN PROGRESS
                </span>
              </div>
              <div className="mt-0.5 text-xs text-mx-muted">
                {signal.pair} · {signal.return_pct}% return · {signal.commission_pct}% master fee
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-mx-muted">Completes in</div>
            <Countdown targetMs={Date.parse(signal.completes_at)} className="text-lg" />
          </div>
        </div>

        <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-mx-muted">Trade progress</span>
            <span className="font-mono text-mx-accent">{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-mx-bg2">
            <div
              className={`h-full rounded-full transition-all ${isWin ? 'bg-mx-up' : 'bg-mx-down'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-mx-border bg-mx-bg2 p-2">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-mx-muted">
              <BarChart3 className="h-3.5 w-3.5 text-mx-accent" /> Projected price path — {signal.pair}
            </div>
            <span className={`font-mono text-xs font-bold ${isWin ? 'text-mx-up' : 'text-mx-down'}`}>
              {isWin ? '+' : '-'}{pct}% target
            </span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visible}>
                <defs>
                  <linearGradient id="gCopy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isWin ? '#22c55e' : '#ef4444'} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={isWin ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2940" />
                <XAxis dataKey="t" hide />
                <YAxis domain={['auto', 'auto']} width={52} tick={{ fill: '#8ba3c7', fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v.toLocaleString(), 'Price']} />
                {target > 0 && (
                  <ReferenceLine
                    y={target}
                    stroke="#f5b301"
                    strokeDasharray="4 4"
                    label={{ value: 'Target', fill: '#f5b301', fontSize: 10, position: 'insideBottomRight' }}
                  />
                )}
                <Area type="monotone" dataKey="price" stroke={isWin ? '#22c55e' : '#ef4444'} fill="url(#gCopy)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {entry > 0 && (
            <div className="flex items-center justify-between px-2 pb-2 pt-1 font-mono text-xs">
              <span className="text-mx-muted">Projected</span>
              <span className="font-bold text-white">${currentProjected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className="text-mx-muted">
                Target ${target.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-mx-muted">
              <Wallet className="h-3 w-3" /> Your investment
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-white">${fmtMoney(amount)}</div>
          </div>
          <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-mx-muted">
              <Timer className="h-3 w-3" /> Entry price
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-white">{entry ? entry.toLocaleString() : '—'}</div>
          </div>
          <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-mx-muted">
              <Percent className="h-3 w-3" /> Master fee
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-mx-muted">${fmtMoney(commission)}</div>
          </div>
          <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-mx-muted">
              <Zap className="h-3 w-3" /> Projected result
            </div>
            {isWin ? (
              <div className="mt-1 font-mono text-sm font-bold text-mx-up">+${fmtMoney(net)}</div>
            ) : (
              <div className="mt-1 font-mono text-sm font-bold text-mx-down">−${fmtMoney(amount)}</div>
            )}
          </div>
        </div>

        <p className="rounded-lg border border-mx-border bg-mx-bg2 px-3 py-2 text-center text-xs text-mx-muted">
          Result is applied to your balance automatically when the timer completes.
          {isWin
            ? ` Payout = ${signal.return_pct}% of your investment minus the ${signal.commission_pct}% master commission.`
            : ` Loss = your full ${signal.loss_pct ?? 100}% of invested amount.`}
        </p>
      </div>
    </Modal>
  );
}

export default function CopyTrade() {
  const { user, refresh } = useAuth();
  const [signals, setSignals] = useState([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    load();
    const unsub = subscribe((msg) => {
      if (msg.type === 'new_signal') load();
      if (msg.type === 'signal_update') {
        setSignals((p) => p.map((s) => (s.id === msg.data.id ? { ...s, ...msg.data } : s)));
        if (msg.data.status === 'completed' || msg.data.status === 'cancelled') {
          setDetail(null);
          refresh();
        }
      }
      if (msg.type === 'copy_update') refresh();
    });
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, [refresh]);

  const load = () => {
    api.get('/api/copy/signals').then(setSignals).catch(() => {});
  };

  const join = async (e) => {
    e.preventDefault();
    if (!code.trim()) return toast('Enter the Master code');
    setBusy(true);
    try {
      await api.post('/api/copy/join', { code });
      setCode('');
      toast('Joined signal! A percentage of your balance is locked until completion.', 'success');
      refresh();
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const active = useMemo(() => signals.filter((s) => s.status === 'active'), [signals, tick]);
  const past = useMemo(() => signals.filter((s) => s.status !== 'active').slice(0, 8), [signals]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Master Copy Trading</h1>
        <p className="text-sm text-mx-muted">Enter the Master's time-sensitive code to lock in a position. Track it live until completion.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Join a Trade" subtitle="Paste the code before it expires" />
          <form onSubmit={join} className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Master Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-accent" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className="pl-10 font-mono uppercase tracking-widest"
                  maxLength={8}
                />
              </div>
            </div>
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-mx-muted">
                  <Percent className="h-3.5 w-3.5 text-mx-accent" /> Investment
                </span>
                <span className="text-mx-muted">Available: ${fmtMoney(user.balance)}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-mx-muted">
                Your stake is a percentage of your balance set by the Master for this code. It is locked automatically on join and refunded or paid out on completion.
              </p>
            </div>
            <Button type="submit" disabled={busy} className="w-full py-3">
              {busy ? <Spinner /> : <Zap className="h-4 w-4" />} Enter Code & Lock In
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-mx-muted">
              Locked funds earn the Master's stated return. A platform commission applies to winnings.
            </p>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Active Signals / Upcoming Trades" subtitle="Join before the code expires — countdown in real time" />
          <div className="divide-y divide-mx-border">
            {active.length === 0 && (
              <div className="px-5 py-12 text-center">
                <Zap className="mx-auto h-8 w-8 text-mx-muted/40" />
                <p className="mt-2 text-sm text-mx-muted">No active signals right now. Codes are dropped live — stay tuned.</p>
              </div>
            )}
            {active.map((s) => {
              const myJoin = s.my_copies && s.my_copies.find((c) => c.status === 'active');
              const totalMs = s.duration_secs * 1000;
              const progress = Math.min(100, Math.max(0, (1 - s.remaining_trade_ms / totalMs) * 100));
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.side === 'long' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                    {s.side === 'long' ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold tracking-wider text-white">{s.code}</span>
                      <Badge status={s.side}>{s.side}</Badge>
                      <Badge status={s.outcome === 'win' ? 'win' : 'loss'}>{s.return_pct}% target</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-mx-muted">
                      <span className="font-mono">{s.pair}</span>
                      <span>Stake {s.percent || 0}% of balance</span>
                      <span>Fee {s.commission_pct}%</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {s.copier_count} copiers</span>
                    </div>
                    {s.not_started ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                        <Timer className="h-3 w-3" /> STARTS IN <Countdown targetMs={Date.now() + (s.starts_in_ms || 0)} inline />
                      </div>
                    ) : (
                      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-mx-bg2">
                        <div className={`h-full rounded-full transition-all ${s.outcome === 'win' ? 'bg-mx-up' : 'bg-mx-down'}`} style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {myJoin ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-mx-up/40 bg-mx-up/10 px-3 py-1 text-xs font-bold text-mx-up">
                          <Lock className="h-3.5 w-3.5" /> LOCKED ${myJoin.amount}
                        </span>
                        <Button variant="ghost" onClick={() => setDetail(s)} className="!px-3 !py-1.5 text-xs">
                          <Eye className="h-3.5 w-3.5" /> Track Live
                        </Button>
                      </>
                    ) : s.code_expired ? (
                      <Badge status="expired">Code expired</Badge>
                    ) : s.not_started ? (
                      <Badge status="win">Code valid</Badge>
                    ) : (
                      <>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-mx-muted">Trade ends</span>
                        <Countdown targetMs={Date.parse(s.completes_at)} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Signal Results" subtitle="Master's executed copy trades" />
        <div className="divide-y divide-mx-border">
          {past.length === 0 && <div className="px-5 py-8 text-center text-sm text-mx-muted">No completed signals yet.</div>}
          {past.map((s) => {
            const myJoin = s.my_copies && s.my_copies.find((c) => c.status === 'completed');
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <CheckCircle2 className={`h-4 w-4 ${s.outcome === 'win' ? 'text-mx-up' : 'text-mx-down'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{s.code}</span>
                    <Badge status={s.outcome}>{s.outcome === 'win' ? 'WIN' : 'LOSS'}</Badge>
                    <span className="text-xs text-mx-muted">{s.pair}</span>
                  </div>
                  <div className="text-xs text-mx-muted">
                    {s.return_pct}% target · closed {fmtTime(s.completed_at)}
                  </div>
                </div>
                <div className="text-right">
                  {myJoin ? (
                    <>
                      <div className="text-[10px] text-mx-muted">Your PnL</div>
                      <PnlText value={myJoin.pnl} />
                    </>
                  ) : (
                    <span className="text-xs text-mx-muted">{s.copier_count} copiers</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {detail && <CopyTradeDetailModal signal={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
