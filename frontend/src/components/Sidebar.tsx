import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { LayoutDashboard, Briefcase, BarChart3, GraduationCap, MessageSquare, Settings, LogOut, ChevronLeft, Layers, LineChart, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/holdings', label: 'Holdings', icon: Briefcase },
  { path: '/market-watch', label: 'Market Watch', icon: BarChart3 },
  { path: '/sectors', label: 'Sectors', icon: Layers },
  { path: '/indexes', label: 'Indexes', icon: LineChart },
  { path: '/learn', label: 'Learn', icon: GraduationCap },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
];

const bottomItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname, setMobileOpen]);

  const isActive = (path: string) => location.pathname === path;

  const goTo = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 h-16 border-b border-slate-100 shrink-0`}>
        {!collapsed && (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => goTo('/dashboard')}>
            <img src="/logo.png" alt="StockSense" className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">StockSense<span className="text-brand-600">.</span></span>
          </div>
        )}
        {collapsed && (
          <img src="/logo.png" alt="S" className="w-8 h-8 object-contain cursor-pointer" onClick={() => goTo('/dashboard')} />
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1 rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
          <ChevronLeft size={16} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 rounded-md hover:bg-slate-100 text-slate-400">
          <X size={18} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => goTo(path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
              ${isActive(path)
                ? 'bg-brand-50 text-brand-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className={`shrink-0 ${isActive(path) ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-100 py-3 px-2 space-y-0.5 shrink-0">
        {bottomItems.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => goTo(path)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group
              ${isActive(path) ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} className={`shrink-0 ${isActive(path) ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* User profile */}
      {user && (
        <div className={`border-t border-slate-100 px-3 py-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? '' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm shadow-brand">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:block shrink-0 h-screen sticky top-0 transition-all duration-200 ${collapsed ? 'w-[68px]' : 'w-60'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-50 lg:hidden transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>
    </>
  );
}

/* Mobile menu trigger — used by AppLayout header */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
      <Menu size={20} />
    </button>
  );
}
