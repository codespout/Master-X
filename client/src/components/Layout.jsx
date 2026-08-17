import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CandlestickChart,
  Copy,
  Wallet,
  Share2,
  History,
  ShieldCheck,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronDown,
  BarChart3,
  Users,
  FileCheck2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, fmtMoney } from '../api';
import { subscribe } from '../ws';
import { Badge, toast } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trade', label: 'Binary Options', icon: CandlestickChart },
  { to: '/copy', label: 'Copy Trading', icon: Copy },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/referral', label: 'Referrals', icon: Share2 },
  { to: '/history', label: 'History', icon: History },
  { to: '/kyc', label: 'KYC & Profile', icon: ShieldCheck }
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Analytics', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/kyc', label: 'KYC Review', icon: FileCheck2 },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/admin/signals', label: 'Signal Codes', icon: Zap },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/security', label: 'Security', icon: ShieldCheck }
];

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-mx-accent/10 text-mx-accent'
            : 'text-mx-muted hover:bg-mx-bg2 hover:text-mx-text'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {item.label}
    </NavLink>
  );
}

function Notifications({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = () => {
    api.get('/api/auth/notifications').then((rows) => {
      setItems(rows);
      setUnread(rows.filter((r) => !r.read).length);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const unsub = subscribe((msg) => {
      if (msg.type === 'notification') {
        setItems((p) => [msg.data, ...p]);
        setUnread((u) => u + 1);
        toast(msg.data.title, 'info');
      }
    });
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      unsub();
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const markRead = async () => {
    await api.post('/api/auth/notifications/read').catch(() => {});
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markRead();
        }}
        className="relative rounded-xl border border-mx-border bg-mx-card p-2.5 text-mx-muted hover:text-mx-text"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mx-accent px-1 text-[10px] font-bold text-slate-950">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-2xl border border-mx-border2 bg-mx-card shadow-2xl">
          <div className="border-b border-mx-border px-4 py-3 text-sm font-semibold text-mx-text">
            Notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-mx-muted">No notifications</div>
            )}
            {items.map((n) => (
              <div key={n.id} className={`border-b border-mx-border/50 px-4 py-3 ${n.read ? '' : 'bg-mx-accent/5'}`}>
                <div className="text-sm font-semibold text-mx-text">{n.title}</div>
                <div className="mt-0.5 text-xs text-mx-muted">{n.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { ...e.detail, id }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener('mx-toast', handler);
    return () => window.removeEventListener('mx-toast', handler);
  }, []);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto fade-in max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl ${
            t.kind === 'error'
              ? 'border-rose-500/40 bg-rose-950/90 text-rose-200'
              : t.kind === 'info'
                ? 'border-sky-500/40 bg-sky-950/90 text-sky-200'
                : 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (['wallet_update', 'trade_update', 'copy_update', 'kyc_update'].includes(msg.type)) refresh();
    });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const isAdmin = user.role === 'admin';

  return (
    <div className="flex h-screen overflow-hidden bg-mx-bg">
      <ToastHost />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-mx-border bg-mx-bg2 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-mx-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mx-accent/15 text-mx-accent">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-white">
              MASTER<span className="text-mx-accent">X</span>
            </div>
            <div className="-mt-0.5 text-[10px] font-medium tracking-widest text-mx-muted">FUTURES & COPY</div>
          </div>
          <button className="ml-auto text-mx-muted lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1 overflow-y-auto px-3 py-4">
          {isAdmin ? (
            <>
              <div className="px-3 pb-1 pt-1 text-[10px] font-bold tracking-widest text-mx-muted/70">
                ADMIN PANEL
              </div>
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </>
          ) : (
            NAV.map((item) => <NavItem key={item.to} item={item} />)
          )}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <div className="rounded-xl border border-mx-border bg-mx-card p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mx-accent to-indigo-500 text-xs font-bold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-mx-text">{user.name}</div>
                <div className="text-xs text-mx-muted">{user.role === 'admin' ? 'Administrator' : user.email}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-mx-border bg-mx-bg2/80 px-4 backdrop-blur lg:px-6">
          <button className="rounded-lg p-2 text-mx-muted hover:bg-mx-bg2 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-mx-up pulse-dot" />
            <span className="text-xs font-medium text-mx-muted">Live Market Feed</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-mx-border bg-mx-card px-3.5 py-2 sm:flex">
              <Wallet className="h-4 w-4 text-mx-accent" />
              <div className="leading-tight">
                <div className="text-[10px] font-medium text-mx-muted">Available Balance</div>
                <div className="font-mono text-sm font-bold text-white">${fmtMoney(user.balance)}</div>
              </div>
            </div>
            {user.kyc_status !== 'approved' && (
              <button
                onClick={() => navigate('/kyc')}
                className="hidden rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 sm:block"
              >
                KYC {user.kyc_status === 'pending' ? 'Reviewing' : 'Required'}
              </button>
            )}
            <Notifications />
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenu((o) => !o)}
                className="flex items-center gap-1.5 rounded-xl border border-mx-border bg-mx-card p-2 text-mx-muted hover:text-mx-text"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-mx-accent to-indigo-500 text-xs font-bold text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-xl border border-mx-border2 bg-mx-card shadow-2xl">
                  <div className="border-b border-mx-border px-4 py-3">
                    <div className="truncate text-sm font-semibold text-mx-text">{user.name}</div>
                    <div className="truncate text-xs text-mx-muted">{user.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      navigate('/kyc');
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-mx-text hover:bg-mx-bg2"
                  >
                    KYC & Profile
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 border-t border-mx-border px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-mx-bg2"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-grid">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
