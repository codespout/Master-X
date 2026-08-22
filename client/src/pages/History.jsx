import { useEffect, useState } from 'react';
import { CandlestickChart, Copy, TrendingUp, TrendingDown } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../api';
import { Card, CardHeader, Badge, PnlText } from '../components/ui';

export default function History() {
  const [tab, setTab] = useState('trades');
  const [trades, setTrades] = useState([]);
  const [copies, setCopies] = useState([]);

  useEffect(() => {
    api.get('/api/trade/history').then(setTrades).catch(() => {});
    api.get('/api/copy/history').then(setCopies).catch(() => {});
  }, []);

  const totalTradePnl = trades.reduce((a, t) => a + Number(t.pnl || 0), 0);
  const totalCopyPnl = copies.reduce((a, c) => a + Number(c.pnl || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Trading History</h1>
          <p className="text-sm text-mx-muted">Complete record of your positions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('trades')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
              tab === 'trades' ? 'border-mx-accent/60 bg-mx-accent/10 text-mx-accent' : 'border-mx-border2 text-mx-muted hover:text-mx-text'
            }`}
          >
            <CandlestickChart className="h-4 w-4" /> Independent Trades
          </button>
          <button
            onClick={() => setTab('copy')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
              tab === 'copy' ? 'border-mx-accent/60 bg-mx-accent/10 text-mx-accent' : 'border-mx-border2 text-mx-muted hover:text-mx-text'
            }`}
          >
            <Copy className="h-4 w-4" /> Copy Trades
          </button>
        </div>
      </div>

      {tab === 'trades' && (
        <Card>
          <CardHeader
            title="Binary Option Positions"
            subtitle={`Total realized PnL: `}
            action={<PnlText value={totalTradePnl} />}
          />
          <div className="divide-y divide-mx-border">
            {trades.length === 0 && <div className="px-5 py-12 text-center text-sm text-mx-muted">No closed binary option trades.</div>}
            {trades.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.side === 'call' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                  {t.side === 'call' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{t.pair}</span>
                    <Badge status={t.side === 'call' ? 'win' : 'loss'}>{t.side === 'call' ? 'CALL' : 'PUT'}</Badge>
                    <Badge status={t.status}>{t.status}</Badge>
                    <span className="text-xs text-mx-muted">+{t.payout_pct}% · {Math.round(t.expiry_secs / 60)}m</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-mx-muted">
                    Entry {t.entry_price?.toLocaleString()} → {t.exit_price?.toLocaleString() || '—'} · {fmtTime(t.opened_at)}
                  </div>
                </div>
                <div className="text-right">
                  <PnlText value={t.pnl} />
                  <div className="text-[10px] text-mx-muted">invested ${fmtMoney(t.amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'copy' && (
        <Card>
          <CardHeader title="Copy Trades" subtitle="Master signal participation" action={<PnlText value={totalCopyPnl} />} />
          <div className="divide-y divide-mx-border">
            {copies.length === 0 && <div className="px-5 py-12 text-center text-sm text-mx-muted">No copy trades yet.</div>}
            {copies.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.outcome === 'win' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                  <Copy className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{c.code}</span>
                    <Badge status={c.outcome}>{c.outcome === 'win' ? 'WIN' : 'LOSS'}</Badge>
                    <Badge status={c.status}>{c.status}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-mx-muted">
                    {c.pair} · {c.side} · target {c.return_pct}% · locked ${fmtMoney(c.amount)} · {fmtTime(c.joined_at)}
                  </div>
                </div>
                <div className="text-right">
                  <PnlText value={c.pnl} />
                  {c.commission > 0 && <div className="text-[10px] text-mx-muted">master fee ${fmtMoney(c.commission)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
