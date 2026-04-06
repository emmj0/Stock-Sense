import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function TopNav() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isLandingPage = location.pathname === '/';
  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-blue-600'
        : 'text-gray-500 hover:text-gray-900'
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
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              StockSense<span className="text-blue-600">.</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
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

          {/* Right side: auth buttons */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
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

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="md:hidden mt-3 pt-3 border-t border-gray-100 space-y-1 animate-fade-in">
            <Link to="/" className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Home</Link>
            <Link to="/market-watch" className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Market Watch</Link>
            <div className="pt-3 flex gap-2">
              <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg">Sign in</Link>
              <Link to="/signup" className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg">Register</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
