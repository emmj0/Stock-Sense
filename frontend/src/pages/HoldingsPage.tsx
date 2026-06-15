import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPortfolio, upsertPortfolioItem, removePortfolioItem, sellStock, fetchIndexes, fetchSectors, fetchPortfolioPredictions } from '../api';
import { Pencil, Trash2, X, CheckCircle2, TrendingUp, TrendingDown, Minus, ShieldCheck, BarChart3, AlertTriangle, Brain, Newspaper, Gauge, Layers, Briefcase, Wallet, Coins, PieChart, ChevronRight } from 'lucide-react';
import { Loader } from '../components/Loader';
import { Toast, ConfirmModal } from '../components/Toast';
import { PageHeader, SectionTitle, EmptyState } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';

interface PortfolioItem { symbol: string; quantity: number; averageCost?: number; }
interface StockInfo {
  name?: string; current?: string; change?: string; percentChange?: string; sectorName?: string;
  open?: string; high?: string; low?: string; ldcp?: string; volume?: string; marketCap?: string; freeFloat?: string;
}
interface PredictionInfo {
  symbol: string; companyName: string; sector: string; signal: string; confidence: number;
  currentPrice: number; predictedPrice: number; predictedReturn: number; horizonDays: number;
  priceRange: { low: number; high: number }; forecastDays: { bullish: number; bearish: number; neutral: number };
  strength: number; reasoning: string; confidenceNote: string | null; llmReasoning: string;
  riskFactors: string[];
  sentiment: { score: number; confidence: number; source: string; key_headlines: string[]; reasoning: string };
  trustLevel: string; trustNote: string | null;
  priceForecast7d: number[];
  quantileForecast7d: { q10: number[]; q25: number[]; q50: number[]; q75: number[]; q90: number[] };
  dataAsOf: string;
}

const ALLOC_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#ef4444'];

/* ── Soft directional outlook (no hard buy/hold/sell) ── */
function outlook(ret: number) {
  if (ret > 1.5) return { label: 'Could go up', Icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-600/15' };
  if (ret < -1.5) return { label: 'Could go down', Icon: TrendingDown, color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-600/15' };
  return { label: 'Likely steady', Icon: Minus, color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-600/15' };
}

/* ── Allocation donut ── */
function Donut({ slices, total }: { slices: { value: number; color: string }[]; total: number }) {
  const size = 150, stroke = 20, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const sum = total || 1;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = (s.value / sum) * C;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} className="transition-all duration-500" />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Value</span>
        <span className="text-base font-bold text-slate-900 font-display">Rs.{(total / 1000).toFixed(0)}k</span>
      </div>
    </div>
  );
}

/* ── Mini sparkline (forecast preview) ── */
function Sparkline({ values, w = 104, h = 34 }: { values: number[]; w?: number; h?: number }) {
  if (!values || values.length < 2) return null;
  const p = 3;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const x = (i: number) => p + (i / (values.length - 1)) * (w - 2 * p);
  const y = (v: number) => p + (1 - (v - mn) / rng) * (h - 2 * p);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  const col = up ? '#10b981' : '#ef4444';
  const id = `sp-${up ? 'u' : 'd'}-${w}`;
  const area = `${d} L${x(values.length - 1).toFixed(1)},${h - p} L${x(0).toFixed(1)},${h - p} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity={0.22} /><stop offset="100%" stopColor={col} stopOpacity={0} /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Day's range bar (low —●— high) ── */
function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const pct = high > low ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100)) : 50;
  return (
    <div className="relative h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400">
      <div className="absolute top-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-800 shadow-md -translate-x-1/2 -translate-y-1/2" style={{ left: `${pct}%` }} />
    </div>
  );
}

/* ── Interactive Forecast Chart ── */
function ForecastChart({ forecast, quantiles, currentPrice }: {
  forecast: number[]; quantiles?: PredictionInfo['quantileForecast7d']; currentPrice: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!forecast?.length) return null;

  const vals = [currentPrice, ...forecast];
  const q10 = quantiles?.q10 || [], q90 = quantiles?.q90 || [];
  const all = [...vals, ...q10, ...q90].filter(Boolean);
  const mn = Math.min(...all) * 0.996, mx = Math.max(...all) * 1.004, rng = mx - mn || 1;

  const W = 520, H = 130, px = 8, py = 16;
  const cw = W - px * 2, ch = H - py * 2;
  const gx = (i: number) => px + (i / (vals.length - 1)) * cw;
  const gy = (v: number) => py + (1 - (v - mn) / rng) * ch;

  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${gx(i).toFixed(1)},${gy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${gx(vals.length - 1).toFixed(1)},${(py + ch).toFixed(1)} L${gx(0).toFixed(1)},${(py + ch).toFixed(1)} Z`;

  let band = '';
  if (q10.length && q90.length) {
    const t = [currentPrice, ...q90].map((v, i) => `${gx(i).toFixed(1)},${gy(v).toFixed(1)}`);
    const b = [currentPrice, ...q10].map((v, i) => `${gx(i).toFixed(1)},${gy(v).toFixed(1)}`).reverse();
    band = `M${t.join(' L')} L${b.join(' L')} Z`;
  }

  const bear = forecast[forecast.length - 1] < currentPrice;
  const col = bear ? '#ef4444' : '#10b981';
  const gradId = bear ? 'grad-bear' : 'grad-bull';
  const days = ['Today', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 140 }} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.15} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(p => <line key={p} x1={px} y1={py + (1 - p) * ch} x2={W - px} y2={py + (1 - p) * ch} stroke="#f0f0f0" strokeWidth={0.5} />)}
      {band && <path d={band} fill={col} opacity={0.05} />}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }}>
          <rect x={gx(i) - 25} y={0} width={50} height={H} fill="transparent" />
          {hover === i && <line x1={gx(i)} y1={py} x2={gx(i)} y2={py + ch} stroke="#d4d4d8" strokeWidth={0.7} strokeDasharray="3,3" />}
          <circle cx={gx(i)} cy={gy(v)} r={hover === i ? 4.5 : 2.5} fill={i === 0 ? '#3b82f6' : col} stroke="white" strokeWidth={hover === i ? 2 : 1} className="transition-all duration-100" />
          <text x={gx(i)} y={H - 2} textAnchor="middle" fontSize={7.5} fill="#c4c4c4" fontFamily="system-ui">{days[i]?.replace('Day ', 'D')}</text>
          {hover === i && (
            <g>
              <rect x={gx(i) - 38} y={gy(v) - 24} width={76} height={20} rx={6} fill="#0f1623" opacity={0.92} />
              <text x={gx(i)} y={gy(v) - 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600" fontFamily="system-ui">
                {days[i]} · Rs.{v.toFixed(1)}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function HoldingsPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [stockDetails, setStockDetails] = useState<{ [key: string]: StockInfo }>({});
  const [predictionMap, setPredictionMap] = useState<{ [key: string]: PredictionInfo }>({});
  const [loading, setLoading] = useState(true);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, averageCost: 0 });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sellSymbol, setSellSymbol] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [selling, setSelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const port = await fetchPortfolio();
      setHoldings(port);
      const [idxs, secs] = await Promise.all([fetchIndexes(), fetchSectors()]);
      const d: { [k: string]: StockInfo } = {};
      const merge = (sym: string, f: StockInfo) => { if (sym) d[sym] = { ...(d[sym] || {}), ...f }; };
      idxs.forEach((idx: any) => (idx.constituents || []).forEach((c: any) => merge(c.SYMBOL, {
        name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'],
        ldcp: c.LDCP, volume: c.VOLUME, marketCap: c['MARKET CAP (M)'], freeFloat: c['FREEFLOAT (M)'],
      })));
      secs.forEach((s: any) => (s.companies || []).forEach((c: any) => merge(c.SYMBOL, {
        name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'],
        open: c.OPEN, high: c.HIGH, low: c.LOW, ldcp: c.LDCP, volume: c.VOLUME, sectorName: s.name,
      })));
      setStockDetails(d);
      try { const p = await fetchPortfolioPredictions(); const m: any = {}; (p || []).forEach((x: any) => { m[x.symbol] = x; }); setPredictionMap(m); } catch {}
      refreshUser().catch(() => {}); // sync wallet balance
    } catch (e: any) { setError(e?.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
    // refreshUser is intentionally omitted — its identity changes on every auth state
    // update, and including it here would retrigger the load effect in an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // lock scroll while any modal is open
  useEffect(() => {
    const open = detailSymbol || editingSymbol || sellSymbol;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDetailSymbol(null); setEditingSymbol(null); setSellSymbol(null); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [detailSymbol, editingSymbol, sellSymbol]);

  const startEdit = (item: PortfolioItem) => { setDetailSymbol(null); setEditingSymbol(item.symbol); setEditForm({ quantity: item.quantity, averageCost: item.averageCost || 0 }); setError(''); setMsg(''); };
  const saveEdit = async () => {
    if (!editingSymbol || editForm.quantity <= 0) { setError('Quantity must be > 0'); return; }
    try { const u = await upsertPortfolioItem({ symbol: editingSymbol, quantity: editForm.quantity, averageCost: editForm.averageCost }); setHoldings(u); setEditingSymbol(null); setMsg(`Updated ${editingSymbol}`); setTimeout(() => setMsg(''), 2500); } catch (e: any) { setError(e?.response?.data?.message || 'Failed'); }
  };
  const del = (sym: string) => setConfirmDelete(sym);
  const executeDelete = async () => {
    const sym = confirmDelete;
    if (!sym) return;
    setConfirmDelete(null);
    setDetailSymbol(null);
    try { const u = await removePortfolioItem(sym); setHoldings(u); setMsg(`Removed ${sym}`); setTimeout(() => setMsg(''), 2500); } catch (e: any) { setError(e?.response?.data?.message || 'Failed'); }
  };

  const startSell = (item: PortfolioItem) => { setDetailSymbol(null); setSellSymbol(item.symbol); setSellQty(item.quantity); setError(''); setMsg(''); };
  const submitSell = async () => {
    if (!sellSymbol || sellQty <= 0) { setError('Quantity must be > 0'); return; }
    setSelling(true);
    try {
      const res = await sellStock(sellSymbol, sellQty);
      setHoldings(res.portfolio);
      setSellSymbol(null);
      setMsg(`Sold ${sellQty} ${sellSymbol} for Rs ${res.proceeds.toLocaleString('en-PK')}`);
      await refreshUser();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not sell'); }
    finally { setSelling(false); }
  };

  // Helpers
  const num = (s?: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;
  const pos = (c?: string) => !!c && !c.startsWith('-') && c !== '0';
  const retCls = (r: number) => r > 0 ? 'text-emerald-600' : r < 0 ? 'text-red-600' : 'text-slate-500';
  const trustCls = (l: string) => l === 'high' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : l === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
  const sentLbl = (s: number) => s >= 0.5 ? 'Positive' : s >= 0.2 ? 'Leaning up' : s >= -0.2 ? 'Mixed' : s >= -0.5 ? 'Leaning down' : 'Negative';
  const sentCls = (s: number) => s >= 0.2 ? 'text-emerald-600' : s >= -0.2 ? 'text-amber-600' : 'text-red-600';
  const clean = (t: string) => (t || '')
    .replace(/TFT model forecasts?/gi, 'our model expects')
    .replace(/TFT/g, 'AI')
    .replace(/Forecast uncertainty:.*?\.\s*/gi, '')
    .replace(/Market sentiment is \w+ \(blended score:.*?\)\.?\s*/gi, '')
    .replace(/\ba\s+BUY\s+action\b/gi, 'a possible upward move')
    .replace(/\ba\s+SELL\s+action\b/gi, 'a possible downward move')
    .replace(/\ba\s+HOLD\s+action\b/gi, 'a roughly steady outlook')
    .replace(/\bBUY\s+action\b/gi, 'an upward move')
    .replace(/\bSELL\s+action\b/gi, 'a downward move')
    .replace(/\bHOLD\s+action\b/gi, 'a steady outlook')
    .replace(/\bBUY\b/g, 'a likely rise').replace(/\bSELL\b/g, 'a likely decline').replace(/\bHOLD\b/g, 'staying steady');

  const totInv = holdings.reduce((s, h) => s + h.quantity * (h.averageCost || 0), 0);
  const totCur = holdings.reduce((s, h) => s + h.quantity * num(stockDetails[h.symbol]?.current), 0);
  const totPnL = totCur - totInv;
  const totPct = totInv > 0 ? (totPnL / totInv) * 100 : 0;

  const alloc = useMemo(() => holdings
    .map((h, i) => ({ symbol: h.symbol, value: h.quantity * num(stockDetails[h.symbol]?.current), color: ALLOC_COLORS[i % ALLOC_COLORS.length] }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value), [holdings, stockDetails]);

  // selected holding for the detail modal
  const sel = detailSymbol ? holdings.find(h => h.symbol === detailSymbol) : null;
  const editItem = editingSymbol ? holdings.find(h => h.symbol === editingSymbol) : null;

  return (
    <div className="page">
      <PageHeader
        title="My Holdings"
        subtitle={`${holdings.length} ${holdings.length === 1 ? 'stock' : 'stocks'} in your portfolio · tap a stock for details`}
        accent="brand"
      />

      {/* Cash wallet banner */}
      <div className="card p-4 mb-5 reveal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Wallet size={20} /></div>
          <div>
            <p className="eyebrow">Available Cash</p>
            <p className="text-xl font-bold text-slate-900 font-display tracking-tight">Rs {(user?.balance || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {loading ? <Loader text="Loading holdings..." /> : holdings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No stocks yet"
          message="You haven't added any holdings. Start building your portfolio from the Dashboard."
          action={<button onClick={() => navigate('/dashboard')} className="btn btn-primary"><BarChart3 size={16} /> Go to Dashboard</button>}
        />
      ) : (
        <>
          {/* ── Portfolio overview ── */}
          <div className="card p-5 mb-5 reveal">
            <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-center">
              <div className="flex items-center gap-5">
                <Donut slices={alloc} total={totCur} />
                <div className="space-y-1.5 min-w-[120px]">
                  <p className="eyebrow mb-1">Allocation</p>
                  {alloc.slice(0, 5).map((a) => (
                    <div key={a.symbol} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-slate-600 font-medium"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.color }} />{a.symbol}</span>
                      <span className="text-slate-400">{totCur > 0 ? Math.round((a.value / totCur) * 100) : 0}%</span>
                    </div>
                  ))}
                  {alloc.length > 5 && <p className="text-[11px] text-slate-400 pl-4">+{alloc.length - 5} more</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: 'Invested', icon: Wallet, val: `Rs. ${totInv.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, cls: 'text-slate-900', tint: 'text-sky-500' },
                  { label: 'Current Value', icon: Coins, val: `Rs. ${totCur.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, cls: 'text-slate-900', tint: 'text-violet-500' },
                  { label: 'Total P&L', icon: totPnL >= 0 ? TrendingUp : TrendingDown, val: `${totPnL >= 0 ? '+' : ''}Rs. ${totPnL.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, cls: totPnL >= 0 ? 'text-emerald-600' : 'text-red-600', tint: totPnL >= 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Return', icon: PieChart, val: `${totPct >= 0 ? '+' : ''}${totPct.toFixed(1)}%`, cls: totPct >= 0 ? 'text-emerald-600' : 'text-red-600', tint: 'text-brand-500' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5">
                    <div className="flex items-center justify-between"><p className="eyebrow">{k.label}</p><k.icon size={15} className={k.tint} /></div>
                    <p className={`text-lg font-bold mt-1.5 tracking-tight font-display ${k.cls}`}>{k.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Holdings list (readable, clickable rows) ── */}
          <div className="card overflow-hidden reveal">
            {/* column header (desktop) */}
            <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Stock</span>
              <span className="text-center">7-Day Trend</span>
              <span className="text-right">Price · Today</span>
              <span className="text-right">Your P&amp;L</span>
              <span className="w-5" />
            </div>

            <div className="divide-y divide-slate-100">
              {holdings.map((item) => {
                const info = stockDetails[item.symbol] || {};
                const pred = predictionMap[item.symbol];
                const curP = num(info.current);
                const inv = item.quantity * (item.averageCost || 0);
                const curV = item.quantity * curP;
                const pnl = curV - inv;
                const pnlPct = inv > 0 ? (pnl / inv) * 100 : 0;
                const o = pred ? outlook(pred.predictedReturn) : null;
                const spark = pred?.priceForecast7d?.length ? [curP || pred.currentPrice, ...pred.priceForecast7d] : [];

                return (
                  <button
                    key={item.symbol}
                    onClick={() => setDetailSymbol(item.symbol)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-slate-50/70 transition-colors group grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_0.8fr_1fr_1fr_auto] gap-3 md:gap-4 items-center"
                  >
                    {/* stock identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-ink-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">
                        {item.symbol.slice(0, 4)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.symbol}</span>
                          {o && <span className={`pill ring-1 ring-inset ${o.color} ${o.bg} ${o.ring} !py-0.5 hidden sm:inline-flex`}><o.Icon size={11} /> {o.label}</span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{info.name || item.symbol} · {item.quantity.toLocaleString()} shares</p>
                      </div>
                    </div>

                    {/* trend sparkline */}
                    <div className="hidden md:flex justify-center">{spark.length ? <Sparkline values={spark} w={92} h={32} /> : <span className="text-xs text-slate-300">—</span>}</div>

                    {/* price + today change */}
                    <div className="hidden md:block text-right">
                      <p className="text-sm font-bold text-slate-900 font-display">Rs. {info.current || '0'}</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${pos(info.change) ? 'text-emerald-600' : 'text-red-600'}`}>{pos(info.change) ? '+' : ''}{info.change} ({info.percentChange})</p>
                    </div>

                    {/* P&L (always visible, right-aligned) */}
                    <div className="text-right">
                      <p className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pnl >= 0 ? '+' : ''}Rs. {pnl.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 md:hidden">Rs. {info.current || '0'} · <span className={pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</span></p>
                      <p className={`text-[11px] font-medium mt-0.5 hidden md:block ${pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</p>
                    </div>

                    <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0 justify-self-end" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Detail modal ── */}
      {sel && (() => {
        const item = sel;
        const info = stockDetails[item.symbol] || {};
        const pred = predictionMap[item.symbol];
        const curP = num(info.current);
        const inv = item.quantity * (item.averageCost || 0);
        const curV = item.quantity * curP;
        const o = pred ? outlook(pred.predictedReturn) : null;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setDetailSymbol(null)} />
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
              {/* header */}
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-ink-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">{item.symbol.slice(0, 4)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{item.symbol}</h2>
                      {o && <span className={`pill ring-1 ring-inset ${o.color} ${o.bg} ${o.ring} !py-0.5`}><o.Icon size={11} /> {o.label}</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{info.name || item.symbol} · {item.quantity.toLocaleString()} shares</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-slate-900 font-display">Rs. {info.current || '0'}</p>
                    <p className={`text-[11px] font-semibold ${pos(info.change) ? 'text-emerald-600' : 'text-red-600'}`}>{pos(info.change) ? '+' : ''}{info.change} ({info.percentChange})</p>
                  </div>
                  <button onClick={() => setDetailSymbol(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={18} /></button>
                </div>
              </div>

              {/* scroll body */}
              <div className="overflow-y-auto px-5 py-5 space-y-4">
                {/* market data */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <SectionTitle icon={BarChart3} right={info.sectorName ? <span className="pill pill-sky">{info.sectorName}</span> : undefined}>Live Market Data</SectionTitle>
                  {info.high && info.low && num(info.high) > num(info.low) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="font-semibold uppercase tracking-wide text-slate-400">Day's Range</span>
                        <span className="text-slate-600 font-medium">{info.low} – {info.high}</span>
                      </div>
                      <RangeBar low={num(info.low)} high={num(info.high)} current={curP} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { l: 'Open', v: info.open }, { l: 'Prev Close', v: info.ldcp }, { l: 'Day High', v: info.high }, { l: 'Day Low', v: info.low },
                      { l: 'Volume', v: info.volume }, { l: 'Market Cap (M)', v: info.marketCap }, { l: 'Free Float (M)', v: info.freeFloat }, { l: 'Today', v: info.percentChange },
                    ].filter(s => s.v).map(s => (
                      <div key={s.l} className="rounded-lg bg-slate-50/70 border border-slate-200/70 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.l}</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{s.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* holding details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Quantity', val: item.quantity.toLocaleString() },
                    { label: 'Avg Cost', val: `Rs. ${(item.averageCost || 0).toFixed(2)}` },
                    { label: 'Invested', val: `Rs. ${inv.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                    { label: 'Current Val', val: `Rs. ${curV.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                  ].map(s => (
                    <div key={s.label} className="tile"><p className="tile-label">{s.label}</p><p className="tile-value">{s.val}</p></div>
                  ))}
                </div>

                {pred ? (
                  <>
                    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/40 to-white p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm"><Brain size={15} /></div>
                        <h3 className="text-sm font-bold text-slate-900">AI Outlook</h3>
                        {pred.dataAsOf && <span className="text-[11px] text-slate-400 ml-auto">as of {pred.dataAsOf}</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="tile">
                          <p className="tile-label">Outlook</p>
                          {o && <span className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-inset ${o.color} ${o.bg} ${o.ring}`}><o.Icon size={12} /> {o.label}</span>}
                          <p className="text-[10px] text-slate-400 mt-1.5">direction</p>
                        </div>
                        <div className="tile"><p className="tile-label">Confidence</p><p className="tile-value">{pred.confidence?.toFixed(1)}%</p><p className="text-[10px] text-slate-400 mt-1">how sure</p></div>
                        <div className="tile"><p className="tile-label">Target Price</p><p className={`tile-value ${retCls(pred.predictedReturn)}`}>Rs. {pred.predictedPrice?.toFixed(2)}</p><p className="text-[10px] text-slate-400 mt-1">in ~7 days</p></div>
                        <div className="tile"><p className="tile-label">Est. Change</p><p className={`tile-value ${retCls(pred.predictedReturn)}`}>{pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%</p><p className="text-[10px] text-slate-400 mt-1">vs today</p></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`rounded-xl border px-3 py-2.5 text-center ${trustCls(pred.trustLevel || 'low')}`}>
                          <div className="flex items-center justify-center gap-1"><ShieldCheck size={13} /><p className="text-[10px] font-semibold uppercase tracking-wide">Trust</p></div>
                          <p className="text-sm font-bold capitalize mt-1">{pred.trustLevel || 'N/A'}</p>
                        </div>
                        <div className="tile !py-2.5"><div className="flex items-center justify-center gap-1 text-slate-400"><Layers size={13} /><p className="text-[10px] font-semibold uppercase tracking-wide">Sector</p></div><p className="text-sm font-bold text-slate-800 mt-1">{pred.sector || info.sectorName || '—'}</p></div>
                        <div className="tile !py-2.5"><div className="flex items-center justify-center gap-1 text-slate-400"><Gauge size={13} /><p className="text-[10px] font-semibold uppercase tracking-wide">Range</p></div><p className="text-sm font-bold text-slate-800 mt-1">{pred.priceRange ? `${pred.priceRange.low?.toFixed(0)} – ${pred.priceRange.high?.toFixed(0)}` : '—'}</p></div>
                      </div>

                      {pred.priceForecast7d?.length > 0 && (
                        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                          <SectionTitle icon={BarChart3}>Price Forecast (7 Days)</SectionTitle>
                          <ForecastChart forecast={pred.priceForecast7d} quantiles={pred.quantileForecast7d} currentPrice={curP} />
                        </div>
                      )}

                      {pred.forecastDays && (
                        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">7-Day Direction</span>
                            <div className="flex items-center gap-3 text-[11px] text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> {pred.forecastDays.bullish} up</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {pred.forecastDays.neutral} flat</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> {pred.forecastDays.bearish} down</span>
                            </div>
                          </div>
                          <div className="flex gap-1 h-2.5 rounded-lg overflow-hidden bg-slate-100">
                            {Array.from({ length: pred.forecastDays.bullish || 0 }).map((_, i) => <div key={`b${i}`} className="flex-1 bg-emerald-400" />)}
                            {Array.from({ length: pred.forecastDays.neutral || 0 }).map((_, i) => <div key={`n${i}`} className="flex-1 bg-amber-400" />)}
                            {Array.from({ length: pred.forecastDays.bearish || 0 }).map((_, i) => <div key={`d${i}`} className="flex-1 bg-red-400" />)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-3">
                      {pred.sentiment && (
                        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2"><Newspaper size={14} className="text-slate-400" /><span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Market Sentiment</span></div>
                            <span className={`text-xs font-bold ${sentCls(pred.sentiment.score)}`}>{sentLbl(pred.sentiment.score)} ({(pred.sentiment.score * 100).toFixed(0)}%)</span>
                          </div>
                          {pred.sentiment.reasoning && <p className="text-sm text-slate-600 leading-relaxed mb-2.5">{pred.sentiment.reasoning}</p>}
                          {pred.sentiment.key_headlines?.length > 0 && (
                            <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Key Headlines</p>
                              {pred.sentiment.key_headlines.slice(0, 3).map((h, i) => <p key={i} className="text-xs text-slate-600 pl-2.5 border-l-2 border-sky-200">{h}</p>)}
                            </div>
                          )}
                        </div>
                      )}
                      {pred.riskFactors?.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3.5">
                          <div className="flex items-center gap-2 mb-2.5"><AlertTriangle size={14} className="text-red-500" /><span className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Risk Factors</span></div>
                          <div className="flex flex-wrap gap-2">{pred.riskFactors.map((r, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-700 font-medium">{r}</span>)}</div>
                        </div>
                      )}
                    </div>

                    {pred.llmReasoning && (
                      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
                        <div className="flex items-center gap-2 mb-2.5"><Brain size={14} className="text-sky-500" /><span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">What this means</span></div>
                        <p className="text-sm leading-relaxed text-slate-700">{clean(pred.llmReasoning)}</p>
                      </div>
                    )}
                    {pred.trustNote && <p className="text-xs text-slate-500 italic px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">{pred.trustNote}</p>}
                  </>
                ) : (
                  <div className="text-center py-7 px-4">
                    <BarChart3 size={26} className="text-slate-300 mx-auto mb-2.5" />
                    <p className="text-sm text-slate-500">No AI outlook available yet</p>
                    <p className="text-xs text-slate-400 mt-1">It will appear once analysis is complete</p>
                  </div>
                )}
              </div>

              {/* footer actions */}
              <div className="flex gap-3 px-5 py-4 border-t border-slate-100 bg-white">
                <button onClick={() => startSell(item)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 flex items-center justify-center gap-2 transition-colors"><Coins size={15} /> Sell</button>
                <button onClick={() => startEdit(item)} className="px-4 py-2.5 text-sm font-semibold bg-sky-50 text-sky-700 rounded-xl hover:bg-sky-100 flex items-center justify-center gap-2 transition-colors"><Pencil size={15} /> Edit</button>
                <button onClick={() => del(item.symbol)} className="px-4 py-2.5 text-sm font-semibold bg-red-50 text-red-600 rounded-xl hover:bg-red-100 flex items-center justify-center gap-2 transition-colors"><Trash2 size={15} /> Remove</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit modal ── */}
      {editItem && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditingSymbol(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Edit holding</p>
                <h2 className="text-2xl font-bold text-white font-display">{editItem.symbol}</h2>
              </div>
              <button onClick={() => setEditingSymbol(null)} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="eyebrow mb-2 block">Quantity</label>
                  <input type="number" min="1" value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })} className="input" />
                </div>
                <div>
                  <label className="eyebrow mb-2 block">Avg Cost (Rs)</label>
                  <input type="number" min="0" step="0.01" value={editForm.averageCost} onChange={e => setEditForm({ ...editForm, averageCost: parseFloat(e.target.value) || 0 })} className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveEdit} className="btn btn-sky flex-1"><CheckCircle2 size={16} /> Save changes</button>
                <button onClick={() => setEditingSymbol(null)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sell modal ── */}
      {sellSymbol && (() => {
        const item = holdings.find(h => h.symbol === sellSymbol);
        if (!item) return null;
        const price = num(stockDetails[sellSymbol]?.current);
        const proceeds = price * sellQty;
        return (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSellSymbol(null)} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Sell holding</p>
                  <h2 className="text-2xl font-bold text-white font-display">{sellSymbol}</h2>
                </div>
                <button onClick={() => setSellSymbol(null)} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Market price</span>
                  <span className="font-bold text-slate-900 font-display">Rs {stockDetails[sellSymbol]?.current || price.toFixed(2)}</span>
                </div>
                <div>
                  <label className="eyebrow mb-2 block">Quantity to sell (you hold {item.quantity})</label>
                  <input type="number" min={1} max={item.quantity} value={sellQty}
                    onChange={e => setSellQty(Math.min(item.quantity, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} className="input" />
                  <button onClick={() => setSellQty(item.quantity)} className="mt-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">Sell all {item.quantity}</button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">You'll receive</span><span className="font-bold text-emerald-600">Rs {proceeds.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">New cash balance</span><span className="font-semibold text-slate-700">Rs {((user?.balance || 0) + proceeds).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={submitSell} disabled={selling || price <= 0} className="btn flex-1 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60 disabled:cursor-not-allowed">
                    {selling ? 'Selling…' : <><Coins size={16} /> Sell for Rs {proceeds.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</>}
                  </button>
                  <button onClick={() => setSellSymbol(null)} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      {msg && <Toast message={msg} type="success" onClose={() => setMsg('')} />}
      {confirmDelete && (
        <ConfirmModal
          title="Remove Stock"
          message={`Are you sure you want to remove ${confirmDelete} from your holdings?`}
          confirmLabel="Remove"
          destructive
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
