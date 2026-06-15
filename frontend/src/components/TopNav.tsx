import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthModal } from './AuthModal';

export default function TopNav() {
  const location = useLocation();
  const { openAuth } = useAuthModal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isLandingPage = location.pathname === '/';
  // Merge into the hero on the landing page; become a soft glass bar once scrolled
  // or on inner guest pages. No hard border line ever.
  const solid = scrolled || mobileMenuOpen || !isLandingPage;
  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-brand-600'
        : 'text-slate-500 hover:text-slate-900'
    }`;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${solid ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'}`}>
      <nav className={`mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 py-3.5 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="StockSense"
              className="w-9 h-9 object-contain group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-display text-lg font-bold text-slate-900 tracking-tight">
              StockSense<span className="text-brand-500">.</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
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
            <div className="hidden md:flex items-center gap-2.5">
              <button
                onClick={() => openAuth('login')}
                className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Sign in
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 rounded-xl hover:bg-brand-600 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
              >
                Register
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="md:hidden mt-3 pt-3 border-t border-slate-100 space-y-1 animate-fade-in">
            <Link to="/" className="block px-3 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-50">Home</Link>
            <Link to="/market-watch" className="block px-3 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-50">Market Watch</Link>
            <div className="pt-3 flex gap-2">
              <button onClick={() => { setMobileMenuOpen(false); openAuth('login'); }} className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50">Sign in</button>
              <button onClick={() => { setMobileMenuOpen(false); openAuth('signup'); }} className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-xl shadow-lg shadow-brand-500/25">Register</button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
