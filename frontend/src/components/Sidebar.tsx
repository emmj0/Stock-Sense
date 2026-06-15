import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { LayoutDashboard, Briefcase, BarChart3, GraduationCap, MessageSquare, Settings, LogOut, ChevronLeft, Layers, LineChart, Menu, X, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { updateProfile } from '../api';
import { resizeImage } from '../lib/image';

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
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname, setMobileOpen]);

  const isActive = (path: string) => location.pathname === path;

  const onPickPhoto = () => fileRef.current?.click();
  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please choose an image file'); return; }
    setAvatarError('');
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      await updateProfile({ avatar: dataUrl });
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const goTo = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const navBtn = (path: string, label: string, Icon: typeof LayoutDashboard, small = false) => {
    const active = isActive(path);
    return (
      <button
        key={path}
        onClick={() => goTo(path)}
        title={collapsed ? label : undefined}
        className={`relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group
          ${small ? 'px-3 py-2' : 'px-3 py-2.5'}
          ${active
            ? 'bg-white/10 text-white shadow-lg shadow-black/20'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'}
          ${collapsed ? 'justify-center' : ''}`}
      >
        {/* active glow bar */}
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600 transition-all duration-200
          ${active ? 'opacity-100' : 'opacity-0 -translate-x-1'}`} />
        <Icon size={small ? 17 : 18} className={`shrink-0 transition-colors ${active ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-200'}`} />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-ink-900 text-slate-200 scrollbar-dark relative overflow-hidden">
      {/* ambient brand glow */}
      <div className="pointer-events-none absolute -top-24 -left-10 w-56 h-56 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -right-10 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />

      {/* Logo */}
      <div className={`relative flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 h-16 border-b border-white/5 shrink-0`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => goTo('/dashboard')}>
            <img src="/logo.png" alt="StockSense" className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-white tracking-tight font-display">StockSense<span className="text-brand-500">.</span></span>
          </div>
        ) : (
          <img src="/logo.png" alt="S" className="w-8 h-8 object-contain cursor-pointer" onClick={() => goTo('/dashboard')} />
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
          <X size={18} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="relative flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {!collapsed && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Menu</p>}
        {navItems.map(({ path, label, icon }) => navBtn(path, label, icon))}
      </nav>

      {/* Bottom section */}
      <div className="relative border-t border-white/5 py-3 px-3 space-y-1 shrink-0">
        {bottomItems.map(({ path, label, icon }) => navBtn(path, label, icon, true))}
        <button
          onClick={() => { logout(); navigate('/'); }}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* User profile + avatar uploader */}
      {user && (
        <div className={`relative border-t border-white/5 px-3 py-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
          <div className="flex items-center gap-2.5">
            <button
              onClick={onPickPhoto}
              title="Change profile photo"
              className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-white/10 shadow-lg shadow-brand-500/30 group"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {uploading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={15} className="text-white" />}
              </span>
            </button>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{avatarError || user.email}</p>
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
      <aside className={`hidden lg:block shrink-0 h-screen sticky top-0 transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-72'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 lg:hidden transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
