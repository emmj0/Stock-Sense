import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useState } from 'react';

export default function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-black hover:text-blue-600 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
            S
          </div>
          <span className="hidden sm:block">StockSense</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          {!user && (
            <>
              <Link to="/" className="text-sm font-medium text-gray-600 hover:text-black transition">
                Home
              </Link>
              <Link to="/market-watch" className="text-sm font-medium text-gray-600 hover:text-black transition">
                Market Watch
              </Link>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-black transition">
                Blog
              </a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-black transition">
                Contact
              </a>
            </>
          )}

          {user && (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm font-medium text-gray-600 hover:text-black transition"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/market-watch')}
                className="text-sm font-medium text-gray-600 hover:text-black transition"
              >
                Market Watch
              </button>
              <button
                className="text-sm font-medium text-gray-600 hover:text-black transition cursor-pointer"
                title="Coming soon"
              >
                Chatbot
              </button>
              <button
                className="text-sm font-medium text-gray-600 hover:text-black transition cursor-pointer"
                title="Coming soon"
              >
                Learn
              </button>
            </>
          )}
        </nav>

        {/* Desktop Auth Buttons / Profile */}
        <div className="hidden lg:flex items-center gap-4">
          {!user && (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-black transition"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Get Started
              </Link>
            </>
          )}

          {user && (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">{user.name}</span>
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                  <button
                    onClick={() => {
                      navigate('/preferences');
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    Edit Preferences
                  </button>

                  <button
                    onClick={() => {
                      navigate('/settings');
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    Settings
                  </button>

                  <div className="border-t border-gray-200 my-2" />

                  <button
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <svg
            className={`w-6 h-6 text-gray-900 transition-transform ${mobileMenuOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white py-4 px-4 sm:px-6 space-y-3">
          {!user && (
            <>
              <Link
                to="/"
                className="block px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/market-watch"
                className="block px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Market Watch
              </Link>
              <a
                href="#"
                className="block px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </a>
              <a
                href="#"
                className="block px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>

              <div className="border-t border-gray-200 pt-3 space-y-3">
                <Link
                  to="/login"
                  className="block px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="block px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </>
          )}

          {user && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 space-y-1">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>

              <button
                onClick={() => {
                  navigate('/dashboard');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  navigate('/market-watch');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition"
              >
                Market Watch
              </button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                title="Coming soon"
              >
                Chatbot
              </button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                title="Coming soon"
              >
                Learn
              </button>

              <div className="border-t border-gray-200 pt-3 space-y-2">
                <button
                  onClick={() => {
                    navigate('/preferences');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition"
                >
                  Edit Preferences
                </button>

                <button
                  onClick={() => {
                    navigate('/settings');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition"
                >
                  Settings
                </button>

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    navigate('/');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
