import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useState, useEffect } from 'react';

export default function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMarketsOpen, setIsMarketsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setIsProfileOpen(false);
    setIsMarketsOpen(false);
  }, [location.pathname]);

  const isLandingPage = location.pathname === '/';
  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-50 glass">
      <nav className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="StockSense"
              className="w-9 h-9 object-contain group-hover:scale-105 transition-transform duration-300"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              StockSense<span className="text-blue-600">.</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          {!user && (
            <div className="hidden md:flex items-center gap-6">
              {isLandingPage ? (
                <>
                  <a href="#features" className={navLinkClass('')}>Features</a>
                  <a href="#how-it-works" className={navLinkClass('')}>How it Works</a>
                  <Link to="/market-watch" className={navLinkClass('/market-watch')}>Market Watch</Link>
                </>
              ) : (
                <>
                  <Link to="/" className={navLinkClass('/')}>Home</Link>
                  <Link to="/market-watch" className={navLinkClass('/market-watch')}>Market Watch</Link>
                </>
              )}
            </div>
          )}

          {user && (
            <div className="hidden md:flex items-center gap-1">
              {[
                { path: '/dashboard', label: 'Dashboard' },
                { path: '/holdings', label: 'Holdings' },
                { path: '/market-watch', label: 'Market' },
                { path: '/learn', label: 'Learn' },
              ].map(({ path, label }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(path)
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  {label}
                </button>
              ))}
              {/* Markets Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsMarketsOpen(!isMarketsOpen)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    isActive('/sectors') || isActive('/indexes')
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  Markets
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isMarketsOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isMarketsOpen && (
                  <div className="absolute left-0 mt-2 w-44 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xl dark:shadow-black/30 py-1 animate-scale-in">
                    <button
                      onClick={() => { navigate('/sectors'); setIsMarketsOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5 ${
                        isActive('/sectors')
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Sectors
                    </button>
                    <button
                      onClick={() => { navigate('/indexes'); setIsMarketsOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5 ${
                        isActive('/indexes')
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Indexes
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/chat')}
                className="ml-1 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
              >
                AI Chat
              </button>
            </div>
          )}

          {/* Right side: auth/profile */}
          <div className="flex items-center gap-2">
            {/* Auth buttons (guest) */}
            {!user && (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-all"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Profile dropdown (logged in) */}
            {user && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name.split(' ')[0]}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xl dark:shadow-black/30 py-1 animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{user.email}</p>
                    </div>
                    {[
                      { label: 'Preferences', path: '/preferences', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                      { label: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                    ].map(({ label, path, icon }) => (
                      <button
                        key={path}
                        onClick={() => { navigate(path); setIsProfileOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                        </svg>
                        {label}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 dark:border-dark-border mt-1 pt-1">
                      <button
                        onClick={() => { logout(); setIsProfileOpen(false); navigate('/'); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-all"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-100 dark:border-dark-border space-y-1 animate-fade-in">
            {!user ? (
              <>
                <Link to="/" className="block px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover">Home</Link>
                <Link to="/market-watch" className="block px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover">Market Watch</Link>
                <div className="pt-3 flex gap-2">
                  <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border rounded-lg">Sign in</Link>
                  <Link to="/signup" className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg">Register</Link>
                </div>
              </>
            ) : (
              <>
                <div className="px-3 py-3 mb-1 bg-gray-50 dark:bg-dark-surface rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-300">{user.email}</p>
                  </div>
                </div>
                {[
                  { path: '/dashboard', label: 'Dashboard' },
                  { path: '/holdings', label: 'Holdings' },
                  { path: '/market-watch', label: 'Market Watch' },
                  { path: '/sectors', label: 'Sectors' },
                  { path: '/indexes', label: 'Indexes' },
                  { path: '/learn', label: 'Learn' },
                  { path: '/chat', label: 'AI Chat' },
                ].map(({ path, label }) => (
                  <button
                    key={path}
                    onClick={() => { navigate(path); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive(path)
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border mt-2 space-y-1">
                  <button onClick={() => { navigate('/preferences'); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover">Preferences</button>
                  <button onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover">Settings</button>
                  <button onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }} className="w-full text-left px-3 py-2.5 text-sm text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">Logout</button>
                </div>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
