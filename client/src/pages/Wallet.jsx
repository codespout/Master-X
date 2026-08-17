import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Copy as CopyIcon, ImageUp, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, fmtMoney, fmtTime } from '../api';
import { subscribe } from '../ws';
import { Card, CardHeader, Badge, Button, Input, PnlText, toast, Spinner } from '../components/ui';

export default function Wallet() {
  const { user, refresh } = useAuth();
  const [settings, setSettings] = useState(null);
  const [txs, setTxs] = useState([]);
  const [tab, setTab] = useState('all');

  const [depAmount, setDepAmount] = useState(100);
  const [depFile, setDepFile] = useState(null);
  const [depTx, setDepTx] = useState('');
  const [depBusy, setDepBusy] = useState(false);

  const [wdAmount, setWdAmount] = useState(50);
  const [wdAddress, setWdAddress] = useState(user.payout_address || '');
  const [wdBusy, setWdBusy] = useState(false);

  const [copied, setCopied] = useState(false);

  const load = () => {
    api.get('/api/wallet/config').then(setSettings).catch(() => {});
    loadTx();
  };

  const loadTx = () => {
    api.get('/api/wallet/transactions?limit=100').then(setTxs).catch(() => {});
  };

  useEffect(() => {
    load();
    const unsub = subscribe((msg) => {
      if (msg.type === 'wallet_update') {
        refresh();
        loadTx();
      }
    });
    return unsub;
  }, [refresh]);

  const copyAddress = () => {
    if (!settings) return;
    navigator.clipboard?.writeText(settings.deposit_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submitDeposit = async (e) => {
    e.preventDefault();
    if (!depFile) return toast('Upload a transaction screenshot as proof');
    const fd = new FormData();
    fd.append('amount', depAmount);
    fd.append('tx_ref', depTx);
    fd.append('proof', depFile);
    setDepBusy(true);
    try {
      await api.upload('/api/wallet/deposit', fd);
      toast('Deposit request submitted for review', 'success');
      setDepFile(null);
      setDepTx('');
      refresh();
      loadTx();
    } catch (err) {
      toast(err.message);
    } finally {
      setDepBusy(false);
    }
  };

  const submitWithdraw = async (e) => {
    e.preventDefault();
    if (!wdAddress.trim()) return toast('Enter your payout address');
    setWdBusy(true);
    try {
      const r = await api.post('/api/wallet/withdraw', { amount: Number(wdAmount), address: wdAddress.trim(), network: settings?.deposit_network || 'USDT-TRC20' });
      toast(`Withdrawal requested. Net ${r.net} after fees & tax.`, 'success');
      refresh();
      loadTx();
    } catch (err) {
      toast(err.message);
    } finally {
      setWdBusy(false);
    }
  };

  const fee = settings ? (Number(wdAmount) * settings.withdrawal_fee_pct) / 100 : 0;
  const tax = settings ? (Number(wdAmount) * settings.withdrawal_tax_pct) / 100 : 0;
  const net = Number(wdAmount) - fee - tax;

  const filtered = tab === 'all' ? txs : txs.filter((t) => t.type === tab);

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'deposit', label: 'Deposits' },
    { key: 'withdrawal', label: 'Withdrawals' },
    { key: 'option_win', label: 'Option Wins' },
    { key: 'copy_win', label: 'Copy Wins' },
    { key: 'commission', label: 'Commissions' },
    { key: 'bonus', label: 'Bonuses' }
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Wallet</h1>
        <p className="text-sm text-mx-muted">Manage deposits, withdrawals and internal ledger balances.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Deposit" subtitle="Manual review — credit after admin approval" />
          <form onSubmit={submitDeposit} className="space-y-4 p-5">
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-4">
              <div className="text-xs font-semibold text-mx-muted">Deposit address ({settings?.deposit_network || 'USDT-TRC20'})</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-mx-border2 bg-mx-card px-3 py-2 font-mono text-xs text-mx-accent">
                  {settings?.deposit_address || 'Loading…'}
                </code>
                <Button type="button" variant="ghost" onClick={copyAddress} className="!px-3 !py-2">
                  {copied ? <Check className="h-4 w-4 text-mx-up" /> : <CopyIcon className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-mx-muted">
                Send {settings?.deposit_network?.split(' ')[0] || 'USDT'} to this address. Only {settings?.deposit_network || 'USDT-TRC20'} supported.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">
                Amount (min ${settings?.min_deposit || '—'})
              </label>
              <Input type="number" min={settings?.min_deposit || 1} value={depAmount} onChange={(e) => setDepAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Transaction screenshot (proof)</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-mx-border2 bg-mx-bg2 p-4 text-sm text-mx-muted hover:border-mx-accent/50">
                <ImageUp className="h-5 w-5 text-mx-accent" />
                {depFile ? (
                  <span className="truncate text-mx-text">{depFile.name}</span>
                ) : (
                  <span>Click to upload payment proof</span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setDepFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Transaction ref (optional)</label>
              <Input value={depTx} onChange={(e) => setDepTx(e.target.value)} placeholder="e.g. 8f3a...c21e" />
            </div>
            <Button type="submit" disabled={depBusy} className="w-full py-3">
              {depBusy ? <Spinner /> : <ArrowDownToLine className="h-4 w-4" />} Submit Deposit Request
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Withdraw" subtitle={`Fees ${settings?.withdrawal_fee_pct || 0}% · Tax ${settings?.withdrawal_tax_pct || 0}%`} />
          <form onSubmit={submitWithdraw} className="space-y-4 p-5">
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-mx-muted">
                <span>Amount (min ${settings?.min_withdrawal || '—'})</span>
                <span>Balance ${fmtMoney(user.balance)}</span>
              </div>
              <Input type="number" min={settings?.min_withdrawal || 1} value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-mx-muted">Payout address ({settings?.deposit_network || 'USDT-TRC20'})</label>
              <Input value={wdAddress} onChange={(e) => setWdAddress(e.target.value)} placeholder="Enter your wallet address" className="font-mono text-xs" />
            </div>
            <div className="rounded-xl border border-mx-border bg-mx-bg2 p-3 text-xs">
              <div className="flex justify-between text-mx-muted"><span>Gross amount</span><span className="font-mono text-mx-text">${fmtMoney(wdAmount)}</span></div>
              <div className="mt-1 flex justify-between text-mx-muted"><span>Platform fee</span><span className="font-mono text-mx-down">−${fmtMoney(fee)}</span></div>
              <div className="mt-1 flex justify-between text-mx-muted"><span>Tax</span><span className="font-mono text-mx-down">−${fmtMoney(tax)}</span></div>
              <div className="mt-1 flex justify-between border-t border-mx-border pt-1.5 font-semibold text-mx-text"><span>You receive</span><span className="font-mono text-mx-up">${fmtMoney(net)}</span></div>
            </div>
            <Button type="submit" disabled={wdBusy} variant="ghost" className="w-full py-3">
              {wdBusy ? <Spinner /> : <ArrowUpFromLine className="h-4 w-4" />} Request Withdrawal
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transactions" subtitle="Complete internal ledger" />
        <div className="flex flex-wrap gap-2 border-b border-mx-border px-5 py-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? 'bg-mx-accent/15 text-mx-accent' : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-mx-border">
          {filtered.length === 0 && <div className="px-5 py-10 text-center text-sm text-mx-muted">No transactions.</div>}
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${['deposit', 'option_win', 'copy_win', 'bonus', 'commission'].includes(t.type) ? 'bg-mx-up/10 text-mx-up' : 'bg-mx-down/10 text-mx-down'}`}>
                {t.type === 'deposit' ? <ArrowDownToLine className="h-4 w-4" /> : t.type === 'withdrawal' ? <ArrowUpFromLine className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium capitalize text-mx-text">{t.type.replace(/_/g, ' ')}</span>
                  <Badge status={t.status} />
                </div>
                <div className="text-xs text-mx-muted">
                  {fmtTime(t.created_at)}
                  {t.type === 'withdrawal' && t.address && ` · → ${t.address.slice(0, 12)}…`}
                  {t.type === 'withdrawal' && t.status === 'completed' && ` · net $${fmtMoney(t.net)}`}
                  {t.proof && ` · proof attached`}
                </div>
              </div>
              <PnlText value={t.amount} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
