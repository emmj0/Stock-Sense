import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PreferencesPage from './pages/PreferencesPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import MarketWatchPage from './pages/MarketWatchPage';
import SectorsPage from './pages/SectorsPage';
import IndexesPage from './pages/IndexesPage';
import LearnPage from './pages/LearnPage';
import { useAuth } from './providers/AuthProvider';
import TopNav from './components/TopNav';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-4 text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <TopNav />
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue" />
            <p className="mt-4 text-gray-400 font-medium">Loading...</p>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
          <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignupPage />} />
          <Route path="/market-watch" element={<MarketWatchPage />} />
          <Route
            path="/sectors"
            element={
              <RequireAuth>
                <SectorsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/indexes"
            element={
              <RequireAuth>
                <IndexesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/learn"
            element={
              <RequireAuth>
                <LearnPage />
              </RequireAuth>
            }
          />
          <Route
            path="/preferences"
            element={
              <RequireAuth>
                <PreferencesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} />} />
        </Routes>
      )}
    </div>
  );
}
