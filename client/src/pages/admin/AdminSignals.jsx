import { useEffect, useState } from 'react';
import { Zap, Plus, Send, TrendingUp, TrendingDown, Users, Ban } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../../api';
import { subscribe } from '../../ws';
import { Card, CardHeader, Badge, Button, Input, Select, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

export default function AdminSignals() {
  const [signals, setSignals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    pair: 'BTCUSDT',
    side: 'long',
    outcome: 'win',
    return_pct: 12,
    duration_secs: 600,
    valid_secs: 120,
    percent: 10,
    commission_pct: 10,
    note: ''
  });

  const load = () => api.get('/api/admin/signals').then(setSignals).catch(() => {});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    load();
    const unsub = subscribe((msg) => {
      if (['new_signal', 'signal_update'].includes(msg.type)) load();
    });
    return unsub;
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api.post('/api/admin/signals', { ...form, return_pct: Number(form.return_pct) });
      toast(`Code ${s.code} dropped — live for ${form.valid_secs}s, trades start when validity ends`, 'success');
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id, action) => {
    try {
      await api.post(`/api/admin/signals/${id}/resolve`, { action });
      toast(`Signal resolved as ${action.toUpperCase()} — outcomes applied to copiers`, 'success');
      load();
    } catch (err) {
      toast(err.message);
    }
  };

  const cancel = async (id) => {
    try {
      await api.post(`/api/admin/signals/${id}/cancel`, {});
      toast('Signal cancelled — copier funds refunded', 'success');
      load();
    } catch (err) {
      toast(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Master Signal Codes" subtitle="Drop time-sensitive copy-trading codes" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Create New Signal" subtitle="Code is live for valid_secs, resolves after duration" />
          <form onSubmit={create} className="space-y-3.5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Pair</label>
                <Select value={form.pair} onChange={set('pair')}>
                  {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Side</label>
                <Select value={form.side} onChange={set('side')}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Outcome</label>
                <Select value={form.outcome} onChange={set('outcome')}>
                  <option value="win">WIN</option>
                  <option value="loss">LOSS</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Return %</label>
                <Input type="number" min={0} value={form.return_pct} onChange={set('return_pct')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Trade duration (s)</label>
                <Input type="number" min={30} value={form.duration_secs} onChange={set('duration_secs')} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Code valid (s)</label>
                <Input type="number" min={15} value={form.valid_secs} onChange={set('valid_secs')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Invest % of balance</label>
                <Input type="number" min={1} max={100} value={form.percent} onChange={set('percent')} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-mx-muted">Master commission %</label>
                <Input type="number" min={0} max={100} value={form.commission_pct} onChange={set('commission_pct')} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-mx-muted">Note (optional)</label>
              <Input value={form.note} onChange={set('note')} placeholder="e.g. BTC momentum breakout" />
            </div>
            <Button type="submit" disabled={busy} className="w-full py-3">
              {busy ? <Spinner /> : <Send className="h-4 w-4" />} Drop Code
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Signal Log" subtitle="All dropped codes" />
          <div className="divide-y divide-mx-border">
            {signals.length === 0 && <div className="px-5 py-14 text-center text-sm text-mx-muted">No signals yet. Drop your first code.</div>}
            {signals.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.side === 'long' ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                  {s.side === 'long' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{s.code}</span>
                    <Badge status={s.status}>{s.status}</Badge>
                    <Badge status={s.side}>{s.side}</Badge>
                    <Badge status={s.outcome}>{s.outcome === 'win' ? `WIN ${s.return_pct}%` : `LOSS ${s.loss_pct}%`}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-mx-muted">
                    <span className="font-mono">{s.pair}</span>
                    <span>{s.percent || 0}% of balance</span>
                    <span>fee {s.commission_pct}%</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {s.copier_count || 0}</span>
                    <span>{fmtTime(s.created_at)}</span>
                  </div>
                  {s.result_message && <div className="mt-1 text-xs text-mx-accent">{s.result_message}</div>}
                </div>
                {s.status === 'active' && (
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={() => resolve(s.id, 'loss')} className="!px-3 !py-1.5 text-xs">Resolve Loss</Button>
                    <Button variant="success" onClick={() => resolve(s.id, 'win')} className="!px-3 !py-1.5 text-xs">Resolve Win</Button>
                    <Button variant="ghost" onClick={() => cancel(s.id)} className="!px-3 !py-1.5 text-xs"><Ban className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
