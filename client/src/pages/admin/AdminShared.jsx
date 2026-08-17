import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Users,
  FileCheck2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Settings,
  ShieldCheck
} from 'lucide-react';

const TABS = [
  { to: '/admin', label: 'Analytics', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/kyc', label: 'KYC Review', icon: FileCheck2 },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/admin/signals', label: 'Signal Codes', icon: Zap },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/security', label: 'Security', icon: ShieldCheck }
];

export default function AdminHeader({ title, subtitle, actions }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="text-sm text-mx-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-mx-accent/15 text-mx-accent'
                    : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
