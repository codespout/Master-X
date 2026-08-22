import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, Copy, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, fmtMoney, fmtTime } from '../api';
import { subscribe } from '../ws';
import { Card, CardHeader, Stat, Countdown, Badge, PnlText } from '../components/ui';

function Ticker({ prices }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {prices.map((p) => (
        <div key={p.symbol} className="rounded-xl border border-mx-border bg-mx-card px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-mx-muted">{p.symbol}</span>
            {p.change >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-mx-up" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-mx-down" />
            )}
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-white">${p.price.toLocaleString()}</div>
          <div className={`mt-0.5 font-mono text-[11px] font-semibold ${p.change >= 0 ? 'text-mx-up' : 'text-mx-down'}`}>
            {p.change >= 0 ? '+' : ''}
            {p.change.toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [prices, setPrices] = useState([]);
  const [signals, setSignals] = useState([]);
  const [txs, setTxs] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.get('/api/market/prices').then(setPrices).catch(() => {});
    api.get('/api/copy/signals').then(setSignals).catch(() => {});
    api.get('/api/wallet/overview').then((d) => setTxs(d.txs)).catch(() => {});
    const unsub = subscribe((msg) => {
      if (msg.type === 'prices') setPrices(msg.data);
      if (msg.type === 'new_signal') {
        setSignals((p) => [msg.data, ...p]);
        setNow(Date.now());
      }
      if (msg.type === 'signal_update') {
        setSignals((p) => p.map((s) => (s.id === msg.data.id ? { ...s, ...msg.data } : s)));
      }
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  const activeSignals = useMemo(
    () => signals.filter((s) => s.status === 'active').slice(0, 4),
    [signals, now]
  );

  const pnl = Number(user.balance) - Number(user.total_deposited) + Number(user.total_withdrawn);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-mx-muted">Here's your live trading overview.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/copy" className="inline-flex items-center gap-2 rounded-xl bg-mx-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
            <Copy className="h-4 w-4" /> Join Signal
          </Link>
          <Link to="/trade" className="inline-flex items-center gap-2 rounded-xl border border-mx-border2 bg-mx-card px-4 py-2.5 text-sm font-semibold text-mx-text hover:border-mx-accent/50">
            <CandlestickChart className="h-4 w-4" /> Trade Options
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Available Balance" value={`$${fmtMoney(user.balance)}`} accent="text-white" />
        <Stat label="Locked in Trades" value={`$${fmtMoney(user.locked)}`} accent="text-mx-accent" />
        <Stat
          label="Net Profit"
          value={`${pnl >= 0 ? '+' : '-'}$${fmtMoney(Math.abs(pnl))}`}
          accent={pnl >= 0 ? 'text-mx-up' : 'text-mx-down'}
        />
        <Stat label="Total Deposited" value={`$${fmtMoney(user.total_deposited)}`} />
      </div>

      <Ticker prices={prices} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Active Signals"
            subtitle="Live Master code drops — join before the code expires"
            action={
              <Link to="/copy" className="text-xs font-semibold text-mx-accent hover:underline">
                View all →
              </Link>
            }
          />
          <div className="divide-y divide-mx-border">
            {activeSignals.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-mx-muted">
                No active signals right now. The Master drops codes in real time.
              </div>
            )}
            {activeSignals.map((s) => {
              const myJoin = s.my_copies && s.my_copies.find((c) => c.status === 'active');
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.outcome === 'win' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white">{s.code}</span>
                      <Badge status={s.side}>{s.side}</Badge>
                      <Badge status={s.outcome}>{s.outcome}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-mx-muted">
                      {s.pair} · {s.return_pct}% return · {s.commission_pct}% master fee · {s.percent || 0}% of balance
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-mx-muted">
                      {myJoin ? 'Joined' : 'Code expires in'}
                    </div>
                    {myJoin ? (
                      <Badge status="active">Locked ${myJoin.amount}</Badge>
                    ) : (
                      <Countdown targetMs={Date.parse(s.expires_at)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" />
          <div className="max-h-[420px] divide-y divide-mx-border overflow-y-auto">
            {txs.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-mx-muted">No transactions yet</div>
            )}
            {txs.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${['deposit', 'option_win', 'copy_win', 'bonus', 'commission'].includes(t.type) ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                  {['deposit', 'bonus', 'commission'].includes(t.type) ? (
                    <ArrowDownToLine className="h-4 w-4" />
                  ) : t.type === 'withdrawal' ? (
                    <ArrowUpFromLine className="h-4 w-4" />
                  ) : (
                    <CandlestickChart className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium capitalize text-mx-text">
                    {t.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-mx-muted">{fmtTime(t.created_at)} · <Badge status={t.status} /></div>
                </div>
                <PnlText value={t.amount} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
