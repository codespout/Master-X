import { useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, XCircle } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../../api';
import { Card, Badge, Button, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

export default function AdminDeposits() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  const load = (st = status) => {
    api.get(`/api/admin/deposits?status=${st}`).then(setRows).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [status]);

  const review = async (id, action) => {
    setBusyId(id);
    try {
      await api.post(`/api/admin/deposits/${id}`, { action });
      toast(`Deposit ${action === 'approve' ? 'approved & credited' : 'rejected'}`, 'success');
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Deposit Management" subtitle="Review proofs and manually credit balances" />

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
          {rows.length === 0 && <div className="px-5 py-14 text-center text-sm text-mx-muted">No {status} deposits.</div>}
          {rows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mx-up/10 text-mx-up">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-mx-text">{t.name}</span>
                  <span className="text-xs text-mx-muted">{t.email}</span>
                  <Badge status={t.status}>{t.status}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-mx-muted">
                  #{t.id} · {fmtTime(t.created_at)} · {t.meta ? JSON.parse(t.meta).tx_ref || 'no ref' : 'no ref'}
                </div>
                {t.proof && (
                  <a href={t.proof} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-mx-accent hover:underline">
                    View proof →
                  </a>
                )}
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-mx-up">+${fmtMoney(t.gross)}</div>
              </div>
              {t.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => review(t.id, 'reject')} disabled={busyId === t.id} className="!px-3 !py-2 text-xs">
                    {busyId === t.id ? <Spinner /> : <XCircle className="h-3.5 w-3.5" />} Reject
                  </Button>
                  <Button variant="success" onClick={() => review(t.id, 'approve')} disabled={busyId === t.id} className="!px-3 !py-2 text-xs">
                    {busyId === t.id ? <Spinner /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve & Credit
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
