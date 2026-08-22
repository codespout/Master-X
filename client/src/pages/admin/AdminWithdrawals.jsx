import { useEffect, useState } from 'react';
import { ArrowUpFromLine, CheckCircle2, XCircle } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../../api';
import { Card, Badge, Button, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

export default function AdminWithdrawals() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  const load = (st = status) => {
    api.get(`/api/admin/withdrawals?status=${st}`).then(setRows).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [status]);

  const review = async (id, action) => {
    setBusyId(id);
    try {
      await api.post(`/api/admin/withdrawals/${id}`, { action });
      toast(`Withdrawal ${action === 'fulfill' ? 'fulfilled' : 'rejected'}& funds ${action === 'reject' ? 'refunded' : 'sent'}`, 'success');
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Withdrawal Management" subtitle="Fulfill payout requests or reject & refund" />

      <div className="flex gap-2">
        {['pending', 'completed', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              status === s ? 'bg-mx-accent/15 text-mx-accent' : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card>
        <div className="divide-y divide-mx-border">
          {rows.length === 0 && <div className="px-5 py-14 text-center text-sm text-mx-muted">No {status} withdrawals.</div>}
          {rows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mx-accent/10 text-mx-accent">
                <ArrowUpFromLine className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-mx-text">{t.name}</span>
                  <span className="text-xs text-mx-muted">{t.email}</span>
                  <Badge status={t.status}>{t.status}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-mx-muted">
                  #{t.id} · {fmtTime(t.created_at)}
                </div>
                <div className="mt-1 font-mono text-xs text-mx-accent">→ {t.address}</div>
              </div>
              <div className="text-right text-xs">
                <div className="font-mono text-lg font-bold text-white">${fmtMoney(t.net)}</div>
                <div className="text-mx-muted">fee ${fmtMoney(t.fee)} · tax ${fmtMoney(t.tax)}</div>
              </div>
              {t.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => review(t.id, 'reject')} disabled={busyId === t.id} className="!px-3 !py-2 text-xs">
                    {busyId === t.id ? <Spinner /> : <XCircle className="h-3.5 w-3.5" />} Reject & Refund
                  </Button>
                  <Button variant="success" onClick={() => review(t.id, 'fulfill')} disabled={busyId === t.id} className="!px-3 !py-2 text-xs">
                    {busyId === t.id ? <Spinner /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark Fulfilled
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
