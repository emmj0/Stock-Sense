import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useState } from 'react';

export default function TopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const scrollTarget = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    if (location.pathname === '/') {
      scrollTarget();
      return;
    }

    navigate('/', { state: { scrollTo: id, ts: Date.now() } });
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-bg/95 backdrop-blur border-b border-dark-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 text-xl font-bold text-white hover:text-accent-blue transition-colors">
          <img src="/logo.png" alt="StockSense" className="h-10 w-10 rounded-lg shadow-lg" />
          <span className="hidden sm:block">StockSense</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-4 sm:gap-6">
          {!user && (
            <>
              <button
                onClick={() => scrollToSection('home')}
                className="text-gray-300 font-semibold rounded-lg hover:text-white hover:bg-dark-card px-3 py-2 transition-all"
              >
                Home
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsMarketOpen((open) => !open)}
                  className="text-gray-300 font-semibold rounded-lg hover:text-white hover:bg-dark-card px-3 py-2 transition-all inline-flex items-center gap-2"
                >
                  Market
                  <span className="text-xs">▾</span>
                </button>
                {isMarketOpen && (
                  <div className="absolute left-0 mt-2 w-44 rounded-xl bg-dark-card border border-dark-border shadow-2xl overflow-hidden">
                    <button
                      onClick={() => {
                        scrollToSection('indexes');
                        setIsMarketOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-dark-border transition-colors"
                    >
                      Indexes
                    </button>
                    <button
                      onClick={() => {
                        scrollToSection('sectors');
                        setIsMarketOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-dark-border transition-colors"
                    >
                      Sectors
                    </button>
                    <button
                      onClick={() => {
                        navigate('/market-watch');
                        setIsMarketOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-dark-border transition-colors"
                    >
                      Market Watch
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => scrollToSection('blogs')}
                className="text-gray-300 font-semibold rounded-lg hover:text-white hover:bg-dark-card px-3 py-2 transition-all"
              >
                Blogs
              </button>

              <button
                onClick={() => scrollToSection('contact')}
                className="text-gray-300 font-semibold rounded-lg hover:text-white hover:bg-dark-card px-3 py-2 transition-all"
              >
                Contact Us
              </button>

              <Link
                to="/login"
                className="px-4 sm:px-6 py-2 text-gray-300 font-semibold rounded-lg hover:text-white hover:bg-dark-card transition-all"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 sm:px-6 py-2 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-500 transition-all"
              >
                Sign Up
              </Link>
            </>
          )}

          {user && (
            <>
              {/* Main Navigation Links */}
              {location.pathname === '/dashboard' && (
                <div className="flex items-center gap-6 hidden sm:flex pr-6 border-r border-dark-border">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-gray-300 hover:text-white transition-colors font-semibold"
                  >
                    📈 Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/market-watch')}
                    className="text-gray-300 hover:text-white transition-colors font-semibold"
                  >
                    📊 Market Watch
                  </button>
                  <button
                    className="text-gray-300 hover:text-white transition-colors font-semibold cursor-pointer"
                    title="Coming soon"
                  >
                    💬 Chatbot
                  </button>
                  <button
                    className="text-gray-300 hover:text-white transition-colors font-semibold cursor-pointer"
                    title="Coming soon"
                  >
                    📚 Learn
                  </button>
                </div>
              )}

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-3 hover:bg-dark-card px-3 py-2 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-blue to-accent-green flex items-center justify-center text-white font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-dark-card border border-dark-border rounded-xl shadow-xl py-2">
                    <div className="px-4 py-3 border-b border-dark-border">
                      <p className="text-sm font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        navigate('/preferences');
                        setIsProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-dark-border hover:text-white transition-colors"
                    >
                      ⚙️ Edit Preferences
                    </button>

                    <button
                      onClick={() => {
                        navigate('/settings');
                        setIsProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-dark-border hover:text-white transition-colors"
                    >
                      🛡️ Settings
                    </button>

                    <button
                      className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-dark-border hover:text-white transition-colors cursor-not-allowed opacity-50"
                      title="Coming soon"
                      disabled
                    >
                      📞 Support
                    </button>

                    <div className="border-t border-dark-border my-2" />

                    <button
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                        navigate('/');
                      }}
                      className="w-full text-left px-4 py-2.5 text-accent-red hover:bg-dark-border transition-colors font-semibold"
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
