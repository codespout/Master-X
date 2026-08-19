import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, X, TrendingUp, TrendingDown, Timer, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, fmtMoney, fmtSigned } from '../api';
import { subscribe } from '../ws';
import TradingViewChart from '../components/TradingViewChart';
import { Card, CardHeader, Badge, Button, Countdown, PnlText, toast, Spinner, Input } from '../components/ui';

const PAIRS = [
  { symbol: 'BTCUSDT', base: 'BTC', precision: 1 },
  { symbol: 'ETHUSDT', base: 'ETH', precision: 2 },
  { symbol: 'BNBUSDT', base: 'BNB', precision: 2 },
  { symbol: 'SOLUSDT', base: 'SOL', precision: 2 },
  { symbol: 'XRPUSDT', base: 'XRP', precision: 4 },
  { symbol: 'DOGEUSDT', base: 'DOGE', precision: 5 }
];

function fmtExpiry(secs) {
  if (secs % 3600 === 0) return `${secs / 3600}h`;
  if (secs % 60 === 0) return `${secs / 60}m`;
  return `${secs}s`;
}

export default function Markets() {
  const { user, refresh } = useAuth();
  const [prices, setPrices] = useState({});
  const [settings, setSettings] = useState(null);
  const [pair, setPair] = useState('BTCUSDT');
  const [side, setSide] = useState('call');
  const [amount, setAmount] = useState(100);
  const [expiry, setExpiry] = useState(300);
  const [open, setOpen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [closingId, setClosingId] = useState(null);

  useEffect(() => {
    api.get('/api/market/prices').then((ps) => {
      const map = {};
      ps.forEach((p) => (map[p.symbol] = p));
      setPrices(map);
    }).catch(() => {});
    api.get('/api/wallet/config').then(setSettings).catch(() => {});
    api.get('/api/trade').then(setOpen).catch(() => {});
    const unsub = subscribe((msg) => {
      if (msg.type === 'prices') {
        const map = {};
        msg.data.forEach((p) => (map[p.symbol] = p));
        setPrices(map);
      }
      if (msg.type === 'trade_update') {
        setOpen((p) => p.filter((t) => t.id !== msg.data.trade_id));
        refresh();
      }
    });
    return unsub;
  }, [refresh]);

  const selected = prices[pair];
  const price = selected ? selected.price : null;
  const precision = PAIRS.find((p) => p.symbol === pair)?.precision ?? 2;
  const payoutPct = settings?.binary_payout_pct ?? 85;
  const expiries = settings?.binary_expiries || [60, 300, 900, 1800, 3600];
  const potentialWin = (amount || 0) * (payoutPct / 100);

  const openTrade = async () => {
    if (!amount || amount <= 0) return toast('Enter a valid investment amount');
    setBusy(true);
    try {
      const t = await api.post('/api/trade/open', { pair, side, amount: Number(amount), expiry_secs: expiry });
      setOpen((p) => [t, ...p]);
      refresh();
      toast(`Binary option opened: ${side.toUpperCase()} ${pair} · $${amount} · ${fmtExpiry(expiry)}`, 'success');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeEarly = async (id) => {
    setClosingId(id);
    try {
      const r = await api.post(`/api/trade/${id}/close`, {});
      setOpen((p) => p.filter((t) => t.id !== id));
      refresh();
      toast(`Closed early — ${r.outcome.toUpperCase()} ${r.pnl >= 0 ? '+' : ''}${r.pnl}`, r.pnl >= 0 ? 'success' : 'error');
    } catch (err) {
      toast(err.message);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Binary Options / Fixed-Time Trading</h1>
          <p className="text-sm text-mx-muted">Predict the direction — win a fixed payout when the timer expires.</p>
        </div>
        <div className="flex gap-3 rounded-xl border border-mx-border bg-mx-card px-4 py-2">
          <div className="text-right">
            <div className="text-[10px] text-mx-muted">Live Price</div>
            <div className="font-mono text-lg font-bold text-white">${price?.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}</div>
          </div>
          {selected && (
            <div className={`flex items-center gap-1 border-l border-mx-border pl-3 font-mono text-sm font-semibold ${selected.change >= 0 ? 'text-mx-up' : 'text-mx-down'}`}>
              {selected.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {selected.change >= 0 ? '+' : ''}
              {selected.change.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-mx-border px-4 py-3">
              {PAIRS.map((p) => (
                <button
                  key={p.symbol}
                  onClick={() => setPair(p.symbol)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                    pair === p.symbol
                      ? 'bg-mx-accent/15 text-mx-accent'
                      : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
                  }`}
                >
                  {p.symbol}
                </button>
              ))}
            </div>
            <TradingViewChart symbol={pair} height={430} title={`${pair} · Fixed-Time Trading`} />
          </Card>

          <Card>
            <CardHeader title="Open Trades" subtitle="Resolved automatically at expiry against the live strike price" />
            <div className="divide-y divide-mx-border">
              {open.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                  <Target className="h-8 w-8 text-mx-muted/40" />
                  <p className="text-sm text-mx-muted">No open trades. Pick a direction and enter the market.</p>
                </div>
              )}
              {open.map((t) => {
                const live = prices[t.pair];
                const mark = live ? live.price : t.mark;
                const inMoney = mark !== undefined && ((t.side === 'call' && mark > t.entry_price) || (t.side === 'put' && mark < t.entry_price));
                const progress = Math.min(100, Math.max(0, (1 - t.remaining_ms / (t.expiry_secs * 1000)) * 100));
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.side === 'call' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                      {t.side === 'call' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">{t.pair}</span>
                        <Badge status={t.side === 'call' ? 'win' : 'loss'}>{t.side === 'call' ? 'CALL ▲' : 'PUT ▼'}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-mx-accent">
                          <Timer className="h-3 w-3" /> {fmtExpiry(t.expiry_secs)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-mx-muted">
                          <Target className="h-3 w-3" /> +{t.payout_pct}% payout
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-mx-muted">
                        Entry {t.entry_price.toLocaleString()} · Now {mark?.toLocaleString() ?? '…'} · Invest ${fmtMoney(t.amount)}
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-mx-bg2">
                        <div
                          className={`h-full rounded-full transition-all ${inMoney ? 'bg-mx-up' : 'bg-mx-down'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-mx-muted">{inMoney ? 'In the money' : 'Out of the money'}</div>
                      <div className="mt-0.5"><PnlText value={inMoney ? potentialWin : -t.amount} /></div>
                      <div className="mt-1"><Countdown targetMs={t.expires_at ? Date.parse(t.expires_at) : 0} /></div>
                    </div>
                    <Button variant="ghost" onClick={() => closeEarly(t.id)} disabled={closingId === t.id} className="!px-3 !py-1.5 text-xs">
                      {closingId === t.id ? <Spinner /> : <X className="h-3.5 w-3.5" />} Close
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="sticky top-4">
            <CardHeader title="Place Binary Option" subtitle={`${pair} · fixed-time expiry`} />
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSide('call')}
                  className={`rounded-xl border py-3 text-sm font-bold transition-colors ${
                    side === 'call'
                      ? 'border-mx-up bg-mx-up/15 text-mx-up'
                      : 'border-mx-border2 text-mx-muted hover:text-mx-text'
                  }`}
                >
                  <TrendingUp className="mx-auto mb-0.5 h-5 w-5" /> CALL · Up
                </button>
                <button
                  onClick={() => setSide('put')}
                  className={`rounded-xl border py-3 text-sm font-bold transition-colors ${
                    side === 'put'
                      ? 'border-mx-down bg-mx-down/15 text-mx-down'
                      : 'border-mx-border2 text-mx-muted hover:text-mx-text'
                  }`}
                >
                  <TrendingDown className="mx-auto mb-0.5 h-5 w-5" /> PUT · Down
                </button>
              </div>

              <div>
                <div className="mb-1.5 flex justify-between text-xs font-semibold text-mx-muted">
                  <span>Expiry (fixed time)</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {expiries.map((e) => (
                    <button
                      key={e}
                      onClick={() => setExpiry(e)}
                      className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                        expiry === e
                          ? 'border-mx-accent bg-mx-accent/15 text-mx-accent'
                          : 'border-mx-border2 text-mx-muted hover:text-mx-text'
                      }`}
                    >
                      {fmtExpiry(e)}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-mx-muted">
                  <span>Now</span>
                  <Countdown targetMs={Date.now() + expiry * 1000} label="expires" />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex justify-between text-xs font-semibold text-mx-muted">
                  <span>Investment (USDT)</span>
                  <span>Balance ${fmtMoney(user.balance)}</span>
                </div>
                <Input type="number" min={settings?.binary_min_amount} max={settings?.binary_max_amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="mt-1 flex justify-between text-[11px] text-mx-muted">
                  <span>Min ${settings?.binary_min_amount} · Max ${settings?.binary_max_amount}</span>
                  <button className="font-semibold text-mx-accent hover:underline" onClick={() => setAmount(Number(user.balance).toFixed(2))}>
                    Use max
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3 text-xs">
                <div className="flex justify-between text-mx-muted"><span>Payout on win</span><span className="font-mono text-mx-up">+${fmtMoney(potentialWin)}</span></div>
                <div className="mt-1 flex justify-between text-mx-muted"><span>Loss on wrong direction</span><span className="font-mono text-mx-down">−${fmtMoney(amount)}</span></div>
                <div className="mt-1 flex justify-between text-mx-muted"><span>Return on investment</span><span className="font-mono text-mx-text">{payoutPct}%</span></div>
              </div>

              <Button
                variant={side === 'call' ? 'success' : 'danger'}
                onClick={openTrade}
                disabled={busy}
                className="w-full py-3"
              >
                {busy ? <Spinner /> : side === 'call' ? 'Open CALL Option' : 'Open PUT Option'}
              </Button>
              <p className="text-center text-[11px] text-mx-muted">
                Trade auto-resolves at expiry against the market strike price.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
