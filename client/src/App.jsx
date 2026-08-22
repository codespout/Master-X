import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Protected from './components/Protected';
import Layout from './components/Layout';
import Login, { Register } from './pages/Login';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import CopyTrade from './pages/CopyTrade';
import Wallet from './pages/Wallet';
import Referral from './pages/Referral';
import History from './pages/History';
import KycProfile from './pages/KycProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminKyc from './pages/admin/AdminKyc';
import AdminDeposits from './pages/admin/AdminDeposits';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminSignals from './pages/admin/AdminSignals';
import AdminSettings from './pages/admin/AdminSettings';
import AdminSecurity from './pages/admin/AdminSecurity';

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />

        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/trade" element={<Markets />} />
          <Route path="/copy" element={<CopyTrade />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/history" element={<History />} />
          <Route path="/kyc" element={<KycProfile />} />
        </Route>

        <Route
          element={
            <Protected admin>
              <Layout />
            </Protected>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/kyc" element={<AdminKyc />} />
          <Route path="/admin/deposits" element={<AdminDeposits />} />
          <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
          <Route path="/admin/signals" element={<AdminSignals />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
