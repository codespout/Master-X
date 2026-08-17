import { useEffect, useState } from 'react';
import { FileCheck2, Eye, MessageSquare, ExternalLink } from 'lucide-react';
import { api, fmtTime } from '../../api';
import { Card, Badge, Button, Modal, Input, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

export default function AdminKyc() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (st = status) => {
    api.get(`/api/admin/kyc?status=${st}`).then(setUsers).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [status]);

  const review = async (id) => {
    setBusy(true);
    try {
      await api.post(`/api/admin/kyc/${id}`, { action, message });
      toast(`KYC ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
      setSelected(null);
      setAction(null);
      setMessage('');
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (u) => {
    setSelected(u);
    setAction(null);
    setMessage(u.kyc_message || '');
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="KYC Review" subtitle="Review documents in detail, then approve or reject with a custom message" />

      <div className="flex gap-2">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              status === s ? 'bg-mx-accent/15 text-mx-accent' : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
            }`}
          >
            {s} ({s === 'pending' ? '—' : '—'})
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.length === 0 && (
          <div className="col-span-full rounded-2xl border border-mx-border bg-mx-card px-5 py-14 text-center text-sm text-mx-muted">
            No {status} KYC submissions.
          </div>
        )}
        {users.map((u) => (
          <Card key={u.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-mx-border px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mx-accent to-indigo-500 text-xs font-bold text-white">
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-mx-text">{u.name}</div>
                <div className="truncate text-xs text-mx-muted">{u.email}</div>
              </div>
              <Badge status={u.kyc_status}>{u.kyc_status}</Badge>
            </div>
            <div className="space-y-2 px-4 py-3">
              {u.kyc_docs?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {u.kyc_docs.map((d) => (
                    <img key={d} src={d} alt="document" className="aspect-square w-full rounded-lg border border-mx-border object-cover" />
                  ))}
                </div>
              ) : (
                <div className="py-4 text-xs text-mx-muted">No documents</div>
              )}
              {u.kyc_message && (
                <div className="flex items-start gap-2 rounded-lg border border-mx-border bg-mx-bg2 p-2 text-xs text-mx-muted">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {u.kyc_message}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-mx-border px-4 py-3">
              <span className="text-xs text-mx-muted">{u.kyc_submitted_at ? fmtTime(u.kyc_submitted_at) : '—'}</span>
              <Button variant="ghost" onClick={() => openDetail(u)} className="!px-3 !py-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" /> Full Details
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`KYC Details — ${selected?.name || ''}`} wide>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4 text-xs">
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div><span className="text-mx-muted">Name: </span><span className="text-mx-text">{selected.name}</span></div>
                <div><span className="text-mx-muted">Email: </span><span className="text-mx-text">{selected.email}</span></div>
                <div><span className="text-mx-muted">User ID: </span><span className="font-mono text-mx-text">#{selected.id}</span></div>
                <div><span className="text-mx-muted">Status: </span><Badge status={selected.kyc_status}>{selected.kyc_status}</Badge></div>
                <div><span className="text-mx-muted">Submitted: </span><span className="text-mx-text">{selected.kyc_submitted_at ? fmtTime(selected.kyc_submitted_at) : '—'}</span></div>
                <div><span className="text-mx-muted">Reviewed: </span><span className="text-mx-text">{selected.kyc_reviewed_at ? fmtTime(selected.kyc_reviewed_at) : '—'}</span></div>
                <div><span className="text-mx-muted">Documents: </span><span className="text-mx-text">{selected.kyc_docs?.length || 0}</span></div>
                <div><span className="text-mx-muted">Referral code: </span><span className="font-mono text-mx-accent">{selected.referral_code || '—'}</span></div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-mx-muted">Documents (click to open full size)</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selected.kyc_docs?.map((d) => (
                  <a key={d} href={d} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border border-mx-border bg-mx-bg2">
                    <img src={d} alt="identity document" className="aspect-[4/5] w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <ExternalLink className="h-3 w-3" /> Open full size
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {selected.kyc_status === 'pending' ? (
              <div className="space-y-3 border-t border-mx-border pt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-mx-muted">
                    {action === 'reject' ? 'Rejection reason (shown to user)' : 'Approval message (shown to user)'}
                  </label>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={action === 'reject' ? 'Documents could not be verified. Please resubmit.' : 'Identity verified successfully.'}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => { setAction('reject'); }} className="flex-1">
                    Reject
                  </Button>
                  <Button variant="success" onClick={() => { setAction('approve'); }} className="flex-1">
                    Approve
                  </Button>
                  {action && (
                    <Button
                      onClick={() => review(selected.id)}
                      disabled={busy}
                      variant={action === 'approve' ? 'success' : 'danger'}
                      className="flex-1"
                    >
                      {busy ? <Spinner /> : <FileCheck2 className="h-4 w-4" />} Confirm {action}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-mx-border bg-mx-bg2 px-3 py-2 text-center text-xs text-mx-muted">
                This submission has already been reviewed as {selected.kyc_status}.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
