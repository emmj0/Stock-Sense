import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { MobileMenuButton } from './Sidebar';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 shrink-0">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="StockSense" className="w-7 h-7 object-contain" />
            <span className="text-sm font-bold text-slate-900">StockSense<span className="text-blue-600">.</span></span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
