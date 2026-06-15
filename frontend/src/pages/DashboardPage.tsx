import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStocks, buyStock, addCredit, fetchWatchlist, addToWatchlist, removeFromWatchlist, fetchNotifications, markNotificationsRead, setNotificationRead, type NotificationItem } from '../api';
import { TableSkeletonLoader } from '../components/Loader';
import { Toast } from '../components/Toast';
import { useAuth } from '../providers/AuthProvider';
import { Search, Bell, Plus, X, TrendingUp, TrendingDown, Check, Star, Mail, MailOpen, Wallet, Coins, ShoppingCart } from 'lucide-react';
import type { Stock } from '../types';

/* ── helpers ── */
const AV_COLORS = ['from-sky-500 to-blue-600', 'from-brand-500 to-orange-600', 'from-emerald-500 to-teal-600', 'from-violet-500 to-fuchsia-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600', 'from-indigo-500 to-violet-600'];
const avatarColor = (s: string) => AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const pct = (s: Stock) => parseFloat((s.changePercent || '0').replace(/[%,]/g, '')) || 0;
const num = (s?: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;
const QUICK_CREDIT = [500, 1000, 5000, 10000];

/* deterministic synthetic series ending at `current` — for chart shape only */
const TF: Record<string, { pts: number; vol: number }> = {
  '1D': { pts: 24, vol: 0.004 }, '1W': { pts: 28, vol: 0.01 }, '1M': { pts: 30, vol: 0.014 },
  '3M': { pts: 45, vol: 0.022 }, '6M': { pts: 60, vol: 0.03 }, '1Y': { pts: 60, vol: 0.045 },
  '5Y': { pts: 70, vol: 0.06 }, 'All': { pts: 80, vol: 0.08 },
};
function buildSeries(symbol: string, current: number, tf: string): number[] {
  const { pts, vol } = TF[tf] || TF['1W'];
  let seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) + pts * 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const arr: number[] = [];
  let v = current * (0.9 + rand() * 0.08);
  for (let i = 0; i < pts; i++) { v += (rand() - 0.48) * current * vol; arr.push(Math.max(v, current * 0.4)); }
  const last = arr[arr.length - 1], diff = current - last;
  return arr.map((x, i) => +(x + diff * (i / (pts - 1))).toFixed(2));
}

/* ── mini sparkline for cards ── */
function Spark({ values, up, w = 110, h = 40 }: { values: number[]; up: boolean; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const p = 2, mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const x = (i: number) => p + (i / (values.length - 1)) * (w - 2 * p);
  const y = (v: number) => p + (1 - (v - mn) / rng) * (h - 2 * p);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const col = up ? '#10b981' : '#ef4444';
  return <svg width={w} height={h} className="overflow-visible"><path d={d} fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ── big interactive area chart ── */
function AreaChart({ values, up }: { values: number[]; up: boolean }) {
  const [hi, setHi] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  if (values.length < 2) return null;
  const W = 600, H = 240, px = 4, pt = 14, pb = 20;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const x = (i: number) => px + (i / (values.length - 1)) * (W - 2 * px);
  const y = (v: number) => pt + (1 - (v - mn) / rng) * (H - pt - pb);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - pb} L${x(0).toFixed(1)},${H - pb} Z`;
  const col = up ? '#10b981' : '#ef4444';
  const id = up ? 'area-up' : 'area-dn';
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHi(Math.round(f * (values.length - 1)));
  };
  const leftPct = hi != null ? (x(hi) / W) * 100 : 0;
  const topPx = hi != null ? y(values[hi]) : 0;

  return (
    <div ref={ref} className="relative select-none" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity={0.25} /><stop offset="100%" stopColor={col} stopOpacity={0} /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={px} y1={pt + g * (H - pt - pb)} x2={W - px} y2={pt + g * (H - pt - pb)} stroke="#f1f5f9" strokeWidth={1} />)}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={col} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {hi != null && (
        <>
          <div className="absolute top-0 bottom-5 w-px border-l border-dashed border-slate-300 pointer-events-none" style={{ left: `${leftPct}%` }} />
          <div className="absolute w-3 h-3 rounded-full bg-white border-2 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: `${leftPct}%`, top: topPx, borderColor: col }} />
          <div className="absolute -translate-x-1/2 -translate-y-full -mt-2 px-2.5 py-1 rounded-lg bg-ink-900 text-white text-[11px] font-semibold whitespace-nowrap pointer-events-none shadow-lg" style={{ left: `${leftPct}%`, top: topPx }}>
            Rs. {values[hi].toLocaleString('en-PK', { maximumFractionDigits: 2 })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── notifications bell (backend-driven) ── */
function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
const notifTone = (t: NotificationItem['type']) =>
  t === 'up' ? { bg: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', Icon: TrendingUp }
    : t === 'down' ? { bg: 'bg-red-50 text-red-600', ring: 'ring-red-100', Icon: TrendingDown }
      : t === 'steady' ? { bg: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100', Icon: Bell }
        : t === 'buy' ? { bg: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', Icon: ShoppingCart }
          : t === 'sell' ? { bg: 'bg-violet-50 text-violet-600', ring: 'ring-violet-100', Icon: Coins }
            : t === 'credit' ? { bg: 'bg-brand-50 text-brand-600', ring: 'ring-brand-100', Icon: Wallet }
              : { bg: 'bg-sky-50 text-sky-600', ring: 'ring-sky-100', Icon: Bell };

function NotificationBell({ items, unread, onMarkRead, onToggleRead, onOpen }: { items: NotificationItem[]; unread: number; onMarkRead: () => void; onToggleRead: (id: string, read: boolean) => void; onOpen: (n: NotificationItem) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="relative p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
        <Bell size={18} className="text-slate-600" />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[22rem] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-scale-in origin-top-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Notifications</span>
                {unread > 0 && <span className="pill pill-brand !py-0.5 !text-[10px]">{unread} new</span>}
              </div>
              {unread > 0 && <button onClick={onMarkRead} className="text-xs font-semibold text-sky-600 hover:text-sky-700">Mark all read</button>}
            </div>
            <div className="max-h-[26rem] overflow-y-auto divide-y divide-slate-50 scrollbar-dark">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No notifications yet.<br />We'll alert you when AI outlooks update.</div>
              ) : items.map(n => {
                const tn = notifTone(n.type);
                return (
                  <div key={n._id} className={`group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/30'}`}
                    onClick={() => { onOpen(n); setOpen(false); }}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tn.bg}`}><tn.Icon size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                      </div>
                      {n.message && <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">{relTime(n.createdAt)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onToggleRead(n._id, !n.read); }}
                      title={n.read ? 'Mark as unread' : 'Mark as read'}
                      className="p-1.5 rounded-lg text-slate-300 opacity-0 group-hover:opacity-100 hover:text-sky-600 hover:bg-sky-50 shrink-0 transition-all">
                      {n.read ? <Mail size={14} /> : <MailOpen size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── notification detail modal ── */
function NotificationModal({ notif, onClose, onToggleRead }: { notif: NotificationItem; onClose: () => void; onToggleRead: (id: string, read: boolean) => void }) {
  const tn = notifTone(notif.type);
  const verdict = notif.type === 'up' ? 'Could go up' : notif.type === 'down' ? 'Could go down' : notif.type === 'steady' ? 'Looks steady'
    : notif.type === 'buy' ? 'Purchase' : notif.type === 'sell' ? 'Sale' : notif.type === 'credit' ? 'Balance added' : 'Update';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ring-4 ${tn.bg} ${tn.ring}`}><tn.Icon size={22} /></div>
            <div>
              {notif.symbol && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{notif.symbol}</p>}
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{verdict}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
          {notif.message && <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">{notif.message}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{new Date(notif.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <span className={`pill ${notif.read ? 'pill-flat' : 'pill-brand'} !py-0.5`}>{notif.read ? 'Read' : 'Unread'}</span>
          </div>
          <button onClick={() => onToggleRead(notif._id, !notif.read)} className="btn btn-secondary w-full">
            {notif.read ? <><Mail size={16} /> Mark as unread</> : <><MailOpen size={16} /> Mark as read</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── stock detail modal ── */
function StockDetailModal({ stock, watched, onToggleWatch, onAdd, onClose }: { stock: Stock; watched: boolean; onToggleWatch: (s: string) => void; onAdd: (s: string) => void; onClose: () => void }) {
  const [tf, setTf] = useState('1W');
  const up = pct(stock) >= 0;
  const series = useMemo(() => buildSeries(stock.symbol, num(stock.current), tf), [stock, tf]);
  const stats = [
    { l: 'Open', v: stock.open }, { l: 'High', v: stock.high }, { l: 'Low', v: stock.low }, { l: 'Volume', v: stock.volume },
  ].filter(s => s.v);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scale-in max-h-[92vh] overflow-y-auto">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(stock.symbol)} text-white flex items-center justify-center text-sm font-bold`}>{stock.symbol.slice(0, 2)}</div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">{stock.symbol}</h2>
              <p className="text-xs text-slate-400">Pakistan Stock Exchange</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className={`pill ${up ? 'pill-up' : 'pill-down'} !py-0.5`}>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{stock.changePercent}</span>
                <span className="text-2xl font-bold text-slate-900 font-display">Rs {stock.current}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Last updated just now</p>
            </div>
            <button onClick={() => onToggleWatch(stock.symbol)} title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              className={`p-2 rounded-lg border transition-colors ${watched ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}>
              <Star size={16} className={watched ? 'fill-amber-400' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* timeframe tabs */}
        <div className="flex flex-wrap gap-1 px-6 mt-4 mb-2">
          {Object.keys(TF).map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tf === t ? 'bg-ink-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t === '1D' ? '1 Day' : t === '1W' ? '1 Week' : t === '1M' ? '1 Month' : t === '3M' ? '3 Month' : t === '6M' ? '6 Month' : t === '1Y' ? '1 Year' : t === '5Y' ? '5 Year' : 'All'}
            </button>
          ))}
        </div>

        <div className="px-6"><AreaChart values={series} up={up} /></div>

        {/* key stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-6 mt-4">
            {stats.map(s => (
              <div key={s.l} className="rounded-lg bg-slate-50/70 border border-slate-200/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.l}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{s.v}</p>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 pt-4">
          <button onClick={() => onAdd(stock.symbol)} className="btn btn-primary w-full"><Plus size={16} /> Add {stock.symbol} to Portfolio</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState('');
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [featuredSym, setFeaturedSym] = useState('');
  const [timeframe, setTimeframe] = useState('1W');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [crediting, setCrediting] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [detailSym, setDetailSym] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoadingStocks(true);
      try {
        const data = await fetchStocks();
        setStocks(data);
        if (data.length) setFeaturedSym(data[0].symbol);
      } catch (err: any) { setError(err?.response?.data?.message || 'Unable to load data'); }
      finally { setLoadingStocks(false); }
    })();
    fetchWatchlist().then(setWatchlist).catch(() => {});
  }, []);

  const isWatched = (sym: string) => watchlist.includes(sym);
  const toggleWatch = async (sym: string) => {
    const watched = isWatched(sym);
    // optimistic update
    setWatchlist(prev => watched ? prev.filter(s => s !== sym) : [...prev, sym]);
    try {
      const next = watched ? await removeFromWatchlist(sym) : await addToWatchlist(sym);
      setWatchlist(next);
    } catch {
      setWatchlist(prev => watched ? [...prev, sym] : prev.filter(s => s !== sym)); // revert
      setError('Could not update watchlist');
    }
  };

  const movers = useMemo(() => [...stocks].sort((a, b) => Math.abs(pct(b)) - Math.abs(pct(a))).slice(0, 12), [stocks]);
  const featured = useMemo(() => stocks.find(s => s.symbol === featuredSym) || stocks[0], [stocks, featuredSym]);
  const series = useMemo(() => featured ? buildSeries(featured.symbol, num(featured.current), timeframe) : [], [featured, timeframe]);

  const featuredIdx = useMemo(() => stocks.findIndex(s => s.symbol === featured?.symbol), [stocks, featured]);

  // auto-cycle the featured stock; pauses while hovered or a modal is open
  const featuredPaused = useRef(false);
  useEffect(() => {
    if (stocks.length < 2) return;
    const id = window.setInterval(() => {
      if (featuredPaused.current || detailSym || selectedSymbol) return;
      setFeaturedSym(prev => {
        const i = stocks.findIndex(s => s.symbol === prev);
        return stocks[(i < 0 ? 0 : i + 1) % stocks.length].symbol;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [stocks, detailSym, selectedSymbol]);

  const watchedStocks = useMemo(() => stocks.filter(s => watchlist.includes(s.symbol)), [stocks, watchlist]);
  const detailStock = useMemo(() => stocks.find(s => s.symbol === detailSym), [stocks, detailSym]);

  const filtered = useMemo(() => {
    if (!search) return stocks;
    return stocks.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [search, stocks]);

  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [openNotif, setOpenNotif] = useState<NotificationItem | null>(null);
  const unread = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);
  const loadNotifs = () => fetchNotifications().then(r => setNotifs(r.notifications)).catch(() => {});
  useEffect(() => { loadNotifs(); }, []);
  const markRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try { await markNotificationsRead(); } catch { loadNotifs(); }
  };
  const toggleNotifRead = async (id: string, read: boolean) => {
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, read } : n));
    setOpenNotif(prev => prev && prev._id === id ? { ...prev, read } : prev);
    try { await setNotificationRead(id, read); } catch { loadNotifs(); }
  };

  // auto-advance the Market Movers carousel; pauses while hovered
  const carouselPaused = useRef(false);
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || movers.length < 2) return;
    const id = window.setInterval(() => {
      const c = carouselRef.current;
      if (!c || carouselPaused.current) return;
      if (c.scrollLeft + c.clientWidth >= c.scrollWidth - 8) c.scrollTo({ left: 0, behavior: 'smooth' });
      else c.scrollBy({ left: 243, behavior: 'smooth' });
    }, 2800);
    return () => window.clearInterval(id);
  }, [movers.length]);

  const submitCredit = async () => {
    const amt = Number(creditAmount);
    if (!amt || amt <= 0) { setCreditError('Enter an amount greater than zero'); return; }
    setCrediting(true); setCreditError('');
    try {
      await addCredit(amt);
      await refreshUser();      // update sidebar balance
      loadNotifs();             // surface the credit notification
      setCreditOpen(false);
      setCreditAmount('');
      setSuccess(`Rs ${amt.toLocaleString('en-PK')} added to your balance`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setCreditError(e?.response?.data?.message || 'Could not add credit');
    } finally {
      setCrediting(false);
    }
  };

  const startAdd = (symbol: string) => { setSelectedSymbol(symbol); setQuantity(1); setError(''); setSuccess(''); };
  const submitAdd = async () => {
    if (!selectedSymbol) return;
    setBuying(true);
    try {
      setError('');
      const res = await buyStock(selectedSymbol, quantity);
      setSuccess(`Bought ${quantity} ${selectedSymbol} for Rs ${res.cost.toLocaleString('en-PK')}`);
      setSelectedSymbol('');
      await refreshUser();      // update sidebar balance
      loadNotifs();             // surface the buy notification
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not buy'); }
    finally { setBuying(false); }
  };

  const fUp = featured ? pct(featured) >= 0 : true;

  return (
    <div className="page">
      {/* top bar: greeting + search + notifications */}
      <div className="relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 reveal">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-tight">My Portfolio</h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋 — browse and track PSX stocks</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search stocks…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { setCreditAmount(''); setCreditError(''); setCreditOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-sm shadow-brand-500/30 transition-colors shrink-0">
            <Wallet size={16} /> <span className="hidden sm:inline">Add Credit</span>
          </button>
          <NotificationBell items={notifs} unread={unread} onMarkRead={markRead} onToggleRead={toggleNotifRead} onOpen={setOpenNotif} />
        </div>
      </div>

      {loadingStocks ? (
        <div className="card p-6"><TableSkeletonLoader /></div>
      ) : stocks.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">No stocks available</div>
      ) : (
        <>
          {/* ── Carousel (auto-scrolling) ── */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">Market Movers</h2>
          </div>
          <div ref={carouselRef}
            onMouseEnter={() => { carouselPaused.current = true; }}
            onMouseLeave={() => { carouselPaused.current = false; }}
            className="flex gap-3 overflow-x-auto pb-2 mb-6 snap-x scroll-pl-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {movers.map((s) => {
              const up = pct(s) >= 0;
              const active = featured?.symbol === s.symbol;
              return (
                <button key={s.id} onClick={() => setDetailSym(s.symbol)}
                  className={`snap-start shrink-0 w-[230px] text-left rounded-2xl border p-4 transition-all ${active ? 'border-brand-300 ring-2 ring-brand-100 bg-white shadow-card' : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-card'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(s.symbol)} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{s.symbol.slice(0, 2)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{s.symbol}</p>
                        <p className="text-[11px] text-slate-400">Rs {s.current}</p>
                      </div>
                    </div>
                    <Spark values={buildSeries(s.symbol, num(s.current), '1W')} up={up} w={54} h={26} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Today</span>
                    <span className={`pill ${up ? 'pill-up' : 'pill-down'} !py-0.5`}>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{s.changePercent}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Featured + watchlist ── */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Featured detail */}
            {featured && (
              <div className="lg:col-span-2 card p-5 reveal" onMouseEnter={() => { featuredPaused.current = true; }} onMouseLeave={() => { featuredPaused.current = false; }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(featured.symbol)} text-white flex items-center justify-center text-sm font-bold`}>{featured.symbol.slice(0, 2)}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{featured.symbol}</h3>
                      <p className="text-xs text-slate-400">Pakistan Stock Exchange · {featuredIdx + 1}/{stocks.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`pill ${fUp ? 'pill-up' : 'pill-down'} !py-0.5`}>{fUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{featured.changePercent}</span>
                        <span className="text-2xl font-bold text-slate-900 font-display">Rs {featured.current}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Last updated just now</p>
                    </div>
                    <button onClick={() => toggleWatch(featured.symbol)} title={isWatched(featured.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                      className={`p-2 rounded-lg border transition-colors ${isWatched(featured.symbol) ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}>
                      <Star size={16} className={isWatched(featured.symbol) ? 'fill-amber-400' : ''} />
                    </button>
                  </div>
                </div>

                {/* timeframe tabs */}
                <div className="flex flex-wrap gap-1 mt-4 mb-2">
                  {Object.keys(TF).map(tf => (
                    <button key={tf} onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${timeframe === tf ? 'bg-ink-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {tf === '1D' ? '1 Day' : tf === '1W' ? '1 Week' : tf === '1M' ? '1 Month' : tf === '3M' ? '3 Month' : tf === '6M' ? '6 Month' : tf === '1Y' ? '1 Year' : tf === '5Y' ? '5 Year' : 'All'}
                    </button>
                  ))}
                </div>

                <AreaChart values={series} up={fUp} />

                {/* key stats + add */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                  {[
                    { l: 'Open', v: featured.open }, { l: 'High', v: featured.high }, { l: 'Low', v: featured.low }, { l: 'Volume', v: featured.volume },
                  ].filter(s => s.v).map(s => (
                    <div key={s.l} className="rounded-lg bg-slate-50/70 border border-slate-200/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.l}</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{s.v}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => startAdd(featured.symbol)} className="btn btn-primary w-full mt-4"><Plus size={16} /> Add {featured.symbol} to Portfolio</button>
              </div>
            )}

            {/* My Watchlist */}
            <div className="card overflow-hidden reveal">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2"><Star size={15} className="text-amber-400 fill-amber-400" /><h3 className="text-sm font-bold text-slate-900">My Watchlist</h3></div>
                <span className="pill pill-brand">{watchedStocks.length}</span>
              </div>
              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
                {watchedStocks.length === 0 ? (
                  <div className="p-8 text-center">
                    <Star size={26} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Your watchlist is empty</p>
                    <p className="text-xs text-slate-400 mt-1">Tap the ⭐ on any stock below to track it here.</p>
                  </div>
                ) : watchedStocks.map(s => {
                  const up = pct(s) >= 0;
                  const active = featured?.symbol === s.symbol;
                  return (
                    <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${active ? 'bg-brand-50/50' : 'hover:bg-slate-50/70'}`}>
                      <button onClick={() => setDetailSym(s.symbol)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(s.symbol)} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{s.symbol.slice(0, 2)}</div>
                        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 truncate">{s.symbol}</p><p className="text-[11px] text-slate-400">Rs {s.current}</p></div>
                        <p className={`text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{s.changePercent}</p>
                      </button>
                      <button onClick={() => toggleWatch(s.symbol)} title="Remove from watchlist" className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-50 shrink-0"><Star size={15} className="fill-amber-400" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── All Stocks (full-width browse) ── */}
          <div className="card overflow-hidden reveal mt-5">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">All Stocks</h3>
              <span className="pill pill-sky">{filtered.length}</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-50">
              {filtered.map(s => {
                const up = pct(s) >= 0;
                const active = featured?.symbol === s.symbol;
                const watched = isWatched(s.symbol);
                return (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${active ? 'bg-brand-50/40' : 'hover:bg-slate-50/70'}`}>
                    <button onClick={() => setDetailSym(s.symbol)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(s.symbol)} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{s.symbol.slice(0, 2)}</div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 truncate">{s.symbol}</p><p className="text-[11px] text-slate-400">Vol {s.volume}</p></div>
                      <div className="text-right w-24"><p className="text-sm font-bold text-slate-900">Rs {s.current}</p><p className={`text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{s.changePercent}</p></div>
                    </button>
                    <button onClick={() => toggleWatch(s.symbol)} title={watched ? 'Remove from watchlist' : 'Add to watchlist'} className={`p-1.5 rounded-lg shrink-0 transition-colors ${watched ? 'text-amber-400 hover:bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}><Star size={15} className={watched ? 'fill-amber-400' : ''} /></button>
                    <button onClick={() => startAdd(s.symbol)} title="Add to portfolio" className="p-1.5 rounded-lg text-slate-300 hover:text-brand-500 hover:bg-brand-50 shrink-0 transition-colors"><Plus size={16} /></button>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No stocks match “{search}”</div>}
            </div>
          </div>
        </>
      )}

      {/* Buy modal */}
      {selectedSymbol && (() => {
        const stk = stocks.find(s => s.symbol === selectedSymbol);
        const price = num(stk?.current);
        const cost = price * quantity;
        const balance = user?.balance || 0;
        const insufficient = cost > balance;
        const maxAffordable = price > 0 ? Math.floor(balance / price) : 0;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSymbol('')} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
              <div className="bg-gradient-to-r from-brand-500 to-orange-600 px-7 py-6 flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-0.5">Buy stock</p>
                  <h2 className="text-2xl font-bold text-white font-display">{selectedSymbol}</h2>
                </div>
                <button onClick={() => setSelectedSymbol('')} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-7 space-y-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Market price</span>
                  <span className="font-bold text-slate-900 font-display">Rs {stk?.current || price.toFixed(2)}</span>
                </div>
                <div>
                  <label className="eyebrow mb-2 block">Quantity (shares)</label>
                  <input type="number" min={1} className="input" value={quantity} onChange={e => setQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 1))} />
                  {maxAffordable > 0 && (
                    <button onClick={() => setQuantity(maxAffordable)} className="mt-1.5 text-[11px] font-semibold text-sky-600 hover:text-sky-700">
                      Max affordable: {maxAffordable} share{maxAffordable === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Total cost</span><span className={`font-bold ${insufficient ? 'text-red-600' : 'text-slate-900'}`}>Rs {cost.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Your balance</span><span className="font-semibold text-slate-700">Rs {balance.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200"><span className="text-slate-500">Balance after</span><span className={`font-semibold ${insufficient ? 'text-red-600' : 'text-emerald-600'}`}>Rs {(balance - cost).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                </div>
                {insufficient && <p className="text-xs text-red-600 font-medium">Not enough balance. Add credit from the sidebar, or lower the quantity.</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={submitAdd} disabled={buying || insufficient || price <= 0} className="btn btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed">
                    {buying ? 'Buying…' : <><Check size={16} /> Buy for Rs {cost.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</>}
                  </button>
                  <button onClick={() => setSelectedSymbol('')} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add credit modal */}
      {creditOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setCreditOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-brand-500 to-orange-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white"><Wallet size={18} /></div>
                <div>
                  <p className="text-white/80 text-xs font-medium">Add Credit</p>
                  <h2 className="text-lg font-bold text-white font-display">Top up balance</h2>
                </div>
              </div>
              <button onClick={() => setCreditOpen(false)} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">Current balance: <span className="font-bold text-slate-800">Rs {(user?.balance || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></p>
              <div>
                <label className="eyebrow mb-2 block">Amount (Rs)</label>
                <input type="number" min={1} autoFocus value={creditAmount}
                  onChange={e => { setCreditAmount(e.target.value); setCreditError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') submitCredit(); }}
                  placeholder="e.g. 5000" className="input" />
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_CREDIT.map(v => (
                  <button key={v} onClick={() => { setCreditAmount(String(v)); setCreditError(''); }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                    +{v.toLocaleString()}
                  </button>
                ))}
              </div>
              {creditError && <p className="text-xs text-red-600 font-medium">{creditError}</p>}
              <button onClick={submitCredit} disabled={crediting} className="btn btn-primary w-full disabled:opacity-60">
                {crediting ? 'Adding…' : <><Plus size={16} /> Add{creditAmount && Number(creditAmount) > 0 ? ` Rs ${Number(creditAmount).toLocaleString()}` : ''} to balance</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock detail modal */}
      {detailStock && <StockDetailModal stock={detailStock} watched={isWatched(detailStock.symbol)} onToggleWatch={toggleWatch} onAdd={(s) => { setDetailSym(''); startAdd(s); }} onClose={() => setDetailSym('')} />}

      {/* Notification detail modal */}
      {openNotif && <NotificationModal notif={openNotif} onClose={() => setOpenNotif(null)} onToggleRead={toggleNotifRead} />}

      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
    </div>
  );
}
