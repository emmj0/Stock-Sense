import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { MobileMenuButton } from './Sidebar';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white/80 backdrop-blur-xl border-b border-slate-200 shrink-0 z-20">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="StockSense" className="w-7 h-7 object-contain" />
            <span className="text-sm font-bold text-slate-900 font-display">StockSense<span className="text-brand-500">.</span></span>
          </div>
        </header>

        {/* Page content — soft tinted backdrop */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
