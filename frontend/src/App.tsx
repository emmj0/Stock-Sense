import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PreferencesPage from './pages/PreferencesPage';
import DashboardPage from './pages/DashboardPage';
import HoldingsPage from './pages/HoldingsPage';
import SettingsPage from './pages/SettingsPage';
import MarketWatchPage from './pages/MarketWatchPage';
import SectorsPage from './pages/SectorsPage';
import IndexesPage from './pages/IndexesPage';
import LearnPage from './pages/LearnPage';
import ChatPage from './pages/ChatPage';
import { useAuth } from './providers/AuthProvider';
import TopNav from './components/TopNav';
import AppLayout from './components/AppLayout';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="mt-3 text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/* Guest pages get the TopNav, auth pages get the Sidebar via AppLayout */
function GuestLayout({ children }: { children: JSX.Element }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopNav />
      {children}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="mt-3 text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Guest routes — with TopNav */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <GuestLayout><LandingPage /></GuestLayout>} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <GuestLayout><LoginPage /></GuestLayout>} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <GuestLayout><SignupPage /></GuestLayout>} />

      {/* Auth routes — with Sidebar layout */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="/market-watch" element={<MarketWatchPage />} />
        <Route path="/sectors" element={<SectorsPage />} />
        <Route path="/indexes" element={<IndexesPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} />} />
    </Routes>
  );
}
