import { useEffect, useState } from 'react';
import { Search, Ban, CheckCircle2, Eye, Save, Coins, KeyRound, Clock } from 'lucide-react';
import { api, fmtMoney, fmtTime } from '../../api';
import { Card, Badge, Input, Button, Select, Modal, toast, Spinner } from '../../components/ui';
import AdminHeader from './AdminShared';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [adjAmount, setAdjAmount] = useState(0);
  const [adjNote, setAdjNote] = useState('');
  const [pwReset, setPwReset] = useState('');
  const [graceDays, setGraceDays] = useState(0);
  const [graceBusy, setGraceBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const load = (query = '') => {
    api.get(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(setUsers).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (u) => {
    setBusyId(u.id);
    try {
      const next = u.status === 'banned' ? 'active' : 'banned';
      await api.post(`/api/admin/users/${u.id}/status`, { status: next });
      toast(next === 'banned' ? 'User suspended' : 'User activated', 'success');
      load(q);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = (u) => {
    setSelected(u);
    setEditing(false);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      kyc_status: u.kyc_status,
      payout_address: u.payout_address || '',
      payout_network: u.payout_network || '',
      telegram_id: u.telegram_id || ''
    });
    setAdjAmount(0);
    setAdjNote('');
    setPwReset('');
    setGraceDays(0);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaveBusy(true);
    try {
      const u = await api.put(`/api/admin/users/${selected.id}`, form);
      setSelected(u);
      setEditing(false);
      toast('User updated', 'success');
      load(q);
    } catch (err) {
      toast(err.message);
    } finally {
      setSaveBusy(false);
    }
  };

  const adjust = async (e) => {
    e.preventDefault();
    if (!adjAmount || Number(adjAmount) === 0) return toast('Enter a non-zero adjustment amount');
    setSaveBusy(true);
    try {
      await api.post(`/api/admin/users/${selected.id}/adjust`, { amount: Number(adjAmount), note: adjNote });
      toast(`Balance adjusted by ${Number(adjAmount) >= 0 ? '+' : ''}${adjAmount}`, 'success');
      const list = await api.get(`/api/admin/users?q=${encodeURIComponent(selected.email)}`);
      const fresh = list.find((u) => u.id === selected.id) || list[0];
      if (fresh) openDetail(fresh);
      load(q);
    } catch (err) {
      toast(err.message);
    } finally {
      setSaveBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!pwReset || pwReset.length < 8) return toast('New password must be at least 8 characters');
    setSaveBusy(true);
    try {
      await api.post(`/api/admin/users/${selected.id}/password`, { new_password: pwReset });
      toast('Password reset successfully — user notified', 'success');
      setPwReset('');
    } catch (err) {
      toast(err.message);
    } finally {
      setSaveBusy(false);
    }
  };

  const setGrace = async (e) => {
    e.preventDefault();
    setGraceBusy(true);
    try {
      const u = await api.post(`/api/admin/users/${selected.id}/grace`, { days: Number(graceDays) });
      setSelected(u);
      toast(graceDays > 0 ? `Withdrawal hold set for ${graceDays} days` : 'Withdrawal hold removed', 'success');
    } catch (err) {
      toast(err.message);
    } finally {
      setGraceBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="User Management" subtitle={`${users.length} users`} />

      <Card>
        <div className="flex items-center gap-3 border-b border-mx-border px-5 py-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mx-muted" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                load(e.target.value);
              }}
              placeholder="Search by name or email…"
              className="pl-10"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mx-border text-left text-[11px] uppercase tracking-wider text-mx-muted">
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Deposited</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mx-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-mx-bg2/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mx-accent to-indigo-500 text-xs font-bold text-white">
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-mx-text">
                          <span className="truncate">{u.name}</span>
                          <Badge status={u.status}>{u.status}</Badge>
                        </div>
                        <div className="truncate text-xs text-mx-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge status={u.role === 'admin' ? 'approved' : 'none'}>{u.role}</Badge></td>
                  <td className="px-4 py-3"><Badge status={u.kyc_status}>{u.kyc_status}</Badge></td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-white">${fmtMoney(u.balance)}</td>
                  <td className="px-4 py-3 text-right font-mono text-mx-up">${fmtMoney(u.total_deposited)}</td>
                  <td className="px-4 py-3 text-xs text-mx-muted">{fmtTime(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" onClick={() => openDetail(u)} className="!px-3 !py-1.5 text-xs">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {u.role !== 'admin' && (
                        <Button
                          variant={u.status === 'banned' ? 'success' : 'ghost'}
                          onClick={() => toggle(u)}
                          disabled={busyId === u.id}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          {busyId === u.id ? <Spinner /> : u.status === 'banned' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`User Detail — ${selected?.name || ''}`} wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-[10px] font-semibold text-mx-muted">Balance</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white">${fmtMoney(selected.balance)}</div>
              </div>
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-[10px] font-semibold text-mx-muted">Locked</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-mx-accent">${fmtMoney(selected.locked)}</div>
              </div>
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-[10px] font-semibold text-mx-muted">Deposited</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-mx-up">${fmtMoney(selected.total_deposited)}</div>
              </div>
              <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3">
                <div className="text-[10px] font-semibold text-mx-muted">Profit</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-mx-down">${fmtMoney(selected.total_profit)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4 text-xs">
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div><span className="text-mx-muted">Email: </span><span className="text-mx-text">{selected.email}</span></div>
                <div><span className="text-mx-muted">Role: </span><span className="capitalize text-mx-text">{selected.role}</span></div>
                <div><span className="text-mx-muted">Status: </span><span className="capitalize text-mx-text">{selected.status}</span></div>
                <div><span className="text-mx-muted">KYC: </span><span className="capitalize text-mx-text">{selected.kyc_status}</span></div>
                <div><span className="text-mx-muted">Referral code: </span><span className="font-mono text-mx-accent">{selected.referral_code || '—'}</span></div>
                <div><span className="text-mx-muted">Referrer: </span><span className="text-mx-text">#{selected.referred_by || '—'}</span></div>
                <div className="sm:col-span-2"><span className="text-mx-muted">Payout: </span><span className="font-mono text-mx-text">{selected.payout_address || '—'}</span></div>
                <div><span className="text-mx-muted">Telegram: </span><span className="text-mx-text">{selected.telegram_id || '—'}</span></div>
                <div><span className="text-mx-muted">Withdrawal hold: </span><span className="text-mx-text">{selected.grace?.active ? `until ${new Date(selected.grace.ends_at).toLocaleDateString()}` : 'none'}</span></div>
                <div className="sm:col-span-2"><span className="text-mx-muted">Joined: </span><span className="text-mx-text">{fmtTime(selected.created_at)}</span></div>
              </div>
            </div>

            {editing ? (
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Name</label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Email</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Role</label>
                    <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Status</label>
                    <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="banned">Banned</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">KYC status</label>
                    <Select value={form.kyc_status} onChange={(e) => setForm((f) => ({ ...f, kyc_status: e.target.value }))}>
                      <option value="none">None</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Payout network</label>
                    <Input value={form.payout_network} onChange={(e) => setForm((f) => ({ ...f, payout_network: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Telegram ID</label>
                    <Input value={form.telegram_id} onChange={(e) => setForm((f) => ({ ...f, telegram_id: e.target.value }))} placeholder="@username" />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-mx-muted">Payout address</label>
                    <Input value={form.payout_address} onChange={(e) => setForm((f) => ({ ...f, payout_address: e.target.value }))} className="font-mono text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saveBusy} className="flex-1">
                    {saveBusy ? <Spinner /> : <Save className="h-4 w-4" />} Save Changes
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(true)} className="flex-1"><Save className="h-4 w-4" /> Edit Details</Button>
              </div>
            )}

            <div className="border-t border-mx-border pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mx-text">
                <Coins className="h-4 w-4 text-mx-gold" /> Balance Adjustment
              </div>
              <form onSubmit={adjust} className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  step="any"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="+/- amount"
                  className="max-w-[140px]"
                />
                <Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Note (reason)" className="max-w-[220px]" />
                <Button type="submit" disabled={saveBusy} className="!py-2">
                  {saveBusy ? <Spinner /> : null} Apply
                </Button>
              </form>
              <p className="mt-1.5 text-[11px] text-mx-muted">Use a positive value to credit, negative to debit. A transaction is recorded in the user's ledger.</p>
            </div>

            <div className="border-t border-mx-border pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mx-text">
                <Clock className="h-4 w-4 text-amber-400" /> Withdrawal Hold Period
              </div>
              <div className="mb-2 text-xs text-mx-muted">
                {selected.grace?.active ? (
                  <>Currently on hold — ends {new Date(selected.grace.ends_at).toLocaleDateString()} ({selected.grace.days_left} days left)</>
                ) : (
                  <>No withdrawal hold active.</>
                )}
              </div>
              <form onSubmit={setGrace} className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  min={0}
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  placeholder="Days"
                  className="max-w-[120px]"
                />
                <Button type="submit" disabled={graceBusy} className="!py-2">
                  {graceBusy ? <Spinner /> : null} {graceDays > 0 ? 'Apply Hold' : 'Clear Hold'}
                </Button>
              </form>
              <p className="mt-1.5 text-[11px] text-mx-muted">Set 0 days to remove the hold immediately.</p>
            </div>

            <div className="border-t border-mx-border pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mx-text">
                <KeyRound className="h-4 w-4 text-mx-accent" /> Reset Password
              </div>
              <form onSubmit={resetPassword} className="flex flex-wrap gap-2">
                <Input
                  type="password"
                  minLength={8}
                  value={pwReset}
                  onChange={(e) => setPwReset(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="max-w-[240px]"
                />
                <Button type="submit" disabled={saveBusy} className="!py-2">
                  {saveBusy ? <Spinner /> : null} Set New Password
                </Button>
              </form>
              <p className="mt-1.5 text-[11px] text-mx-muted">The user is notified and can sign in with the new password immediately.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
