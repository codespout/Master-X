import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  FileCheck2,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { api, fmtMoney } from '../../api';
import { Card, CardHeader } from '../../components/ui';
import AdminHeader from './AdminShared';

function StatCard({ icon: Icon, label, value, accent = 'text-white', sub }) {
  return (
    <div className="rounded-2xl border border-mx-border bg-mx-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-mx-muted">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${accent}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className={`mt-2 font-mono text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-mx-muted">{sub}</div>}
    </div>
  );
}

const tooltipStyle = {
  background: '#0d1524',
  border: '1px solid #2a3b59',
  borderRadius: 12,
  fontSize: 12
};

const RANGES = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' }
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [range, setRange] = useState('7d');

  useEffect(() => {
    api.get(`/api/admin/stats?range=${range}`).then(setStats).catch(() => {});
  }, [range]);

  if (!stats) return null;

  const { signupsByDay, depositsByDay } = stats;
  const chartData = [...new Set([...signupsByDay.map((d) => d.day), ...depositsByDay.map((d) => d.day)])]
    .sort()
    .map((day) => ({
      day,
      signups: signupsByDay.find((d) => d.day === day)?.c || 0,
      deposits: depositsByDay.find((d) => d.day === day)?.s || 0
    }));
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || range;
  const chartTitle = `Signups — ${rangeLabel}`;
  const depositTitle = `Deposits (USDT) — ${rangeLabel}`;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Admin Analytics"
        subtitle="Platform performance overview — all figures are computed from live platform data"
        actions={
          <div className="flex flex-wrap gap-1 rounded-xl border border-mx-border bg-mx-card p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  range === r.key ? 'bg-mx-accent/15 text-mx-accent' : 'text-mx-muted hover:text-mx-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} active`} accent="text-mx-accent" />
        <StatCard icon={UserPlus} label="New Signups" value={stats.newSignups} sub={`in ${rangeLabel}`} accent="text-emerald-400" />
        <StatCard icon={ArrowDownToLine} label="Total Deposits" value={`$${fmtMoney(stats.deposits)}`} sub={`${stats.depositCount} approved · ${rangeLabel}`} accent="text-mx-up" />
        <StatCard icon={ArrowUpFromLine} label="Total Withdrawals" value={`$${fmtMoney(stats.withdrawals)}`} sub={`${stats.withdrawalCount} fulfilled · ${rangeLabel}`} accent="text-mx-accent" />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Master Commission" value={`$${fmtMoney(stats.masterCommission)}`} sub={`in ${rangeLabel}`} accent="text-mx-gold" />
        <StatCard icon={Users} label="Referral Commissions" value={`$${fmtMoney(stats.referralCommission)}`} sub={`$${fmtMoney(stats.bonuses)} in bonuses`} />
        <StatCard icon={Zap} label="Binary Volume" value={`$${fmtMoney(stats.binaryVolume)}`} sub={`$${fmtMoney(stats.binaryProfit)} in profit`} accent="text-sky-400" />
        <StatCard icon={FileCheck2} label="Pending KYC" value={stats.pendingKyc} accent="text-amber-400" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={chartTitle} />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2940" />
                <XAxis dataKey="day" tick={{ fill: '#8ba3c7', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: '#8ba3c7', fontSize: 11 }} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="signups" stroke="#38bdf8" fill="url(#gSignups)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title={depositTitle} />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2940" />
                <XAxis dataKey="day" tick={{ fill: '#8ba3c7', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: '#8ba3c7', fontSize: 11 }} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${fmtMoney(v)}`, 'Deposits']} />
                <Bar dataKey="deposits" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
