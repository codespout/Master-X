import { useEffect, useState } from 'react';
import { Link2, Copy as CopyIcon, Check, Share2, Trophy, ArrowRight } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../api';
import { Card, CardHeader, Badge, PnlText } from '../components/ui';

export default function Referral() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/api/referral').then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Referral Program</h1>
        <p className="text-sm text-mx-muted">Earn commissions on referral deposits & profits plus a fixed bonus per referral.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your Referral Link" subtitle="Share it — every successful referral climbs your rank" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-mx-border bg-mx-bg2 px-4 py-3">
                <Link2 className="h-4 w-4 shrink-0 text-mx-accent" />
                <code className="min-w-0 truncate font-mono text-xs text-mx-accent">{data.link}</code>
              </div>
              <button onClick={() => copy(data.link)} className="rounded-xl border border-mx-border2 bg-mx-card px-4 py-3 text-mx-muted hover:text-mx-text">
                {copied ? <Check className="h-4 w-4 text-mx-up" /> : <CopyIcon className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-mx-border bg-mx-bg2 p-4">
              <Share2 className="h-5 w-5 text-mx-accent" />
              <div>
                <div className="text-xs text-mx-muted">Your code</div>
                <div className="font-mono text-lg font-bold text-white">{data.referral_code}</div>
              </div>
              <button
                onClick={() => copy(data.referral_code)}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-mx-accent hover:bg-mx-bg2"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Rank Progress" subtitle="Automatic tier progression" />
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${data.rank.color}20`, color: data.rank.color }}>
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{data.rank.name}</div>
                <div className="text-xs text-mx-muted">
                  {data.refs} successful referral{data.refs === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {data.ranks.map((r) => {
                const current = r.code === data.rank.code;
                const reached = data.refs >= r.minRefs;
                return (
                  <div
                    key={r.code}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      current ? 'border-mx-accent/50 bg-mx-accent/10' : 'border-mx-border bg-mx-bg2'
                    }`}
                  >
                    <span className="w-7 font-mono font-bold" style={{ color: current ? data.rank.color : '#64748b' }}>
                      {r.code}
                    </span>
                    <span className={`flex-1 font-semibold ${reached ? 'text-mx-text' : 'text-mx-muted'}`}>{r.name}</span>
                    <span className="text-mx-muted">{r.minRefs} refs</span>
                    {current && <Badge status="active">Current</Badge>}
                  </div>
                );
              })}
            </div>
            {data.next_rank && (
              <div className="mt-3 flex items-center gap-2 text-xs text-mx-muted">
                <ArrowRight className="h-3.5 w-3.5 text-mx-accent" />
                {data.next_rank.minRefs - data.refs} more referral{data.next_rank.minRefs - data.refs === 1 ? '' : 's'} to unlock <span className="font-semibold text-mx-accent">{data.next_rank.name}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Earnings Overview" />
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4">
              <div className="text-xs text-mx-muted">Total commissions earned</div>
              <div className="mt-1 font-mono text-2xl font-bold text-mx-up">${fmtMoney(data.total_commission)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-xs text-mx-muted">Deposit share</div>
                <div className="mt-1 font-mono text-sm font-bold text-white">{data.rank.depositShare * 100}%</div>
              </div>
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-xs text-mx-muted">Profit share</div>
                <div className="mt-1 font-mono text-sm font-bold text-white">{data.rank.profitShare * 100}%</div>
              </div>
            </div>
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3 text-xs text-mx-muted">
              Referral bonus: <span className="font-semibold text-mx-accent">{data.settings.referral_bonus_pct}%</span> of the first deposit (min ${data.settings.referral_min_first_deposit}) from each referral
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your Referrals" subtitle={`${data.refs} successful`} />
          <div className="max-h-72 divide-y divide-mx-border overflow-y-auto">
            {data.referrals.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-mx-muted">No referrals yet. Share your link!</div>
            )}
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mx-accent/10 font-bold text-mx-accent">
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-mx-text">{r.name}</div>
                  <div className="text-xs text-mx-muted">{fmtTime(r.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-mx-text">${fmtMoney(r.total_deposited)}</div>
                  <div className="text-[10px] text-mx-muted">{r.deposit_count} deposits</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Commission History" />
          <div className="max-h-72 divide-y divide-mx-border overflow-y-auto">
            {data.my_commissions.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-mx-muted">No commissions yet.</div>
            )}
            {data.my_commissions.map((c) => {
              let meta = {};
              try {
                meta = JSON.parse(c.meta || '{}');
              } catch {
                /* noop */
              }
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize text-mx-text">
                      {(meta.kind || 'commission').replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-mx-muted">{fmtTime(c.created_at)} · rank {meta.rank || 'BR'}</div>
                  </div>
                  <PnlText value={c.amount} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
