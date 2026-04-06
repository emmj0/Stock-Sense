import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPortfolio, upsertPortfolioItem, removePortfolioItem, fetchIndexes, fetchSectors, fetchPortfolioPredictions } from '../api';
import { Pencil, Trash2, X, CheckCircle2, TrendingUp, TrendingDown, ShieldCheck, BarChart3, AlertTriangle, Brain, Newspaper, Target, Gauge, Layers } from 'lucide-react';
import { Loader } from '../components/Loader';
import { Toast, ConfirmModal } from '../components/Toast';

interface PortfolioItem { symbol: string; quantity: number; averageCost?: number; }
interface StockInfo { name?: string; current?: string; change?: string; percentChange?: string; sectorName?: string; }
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

  const W = 480, H = 120, px = 8, py = 16;
  const cw = W - px * 2, ch = H - py * 2;
  const gx = (i: number) => px + (i / (vals.length - 1)) * cw;
  const gy = (v: number) => py + (1 - (v - mn) / rng) * ch;

  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${gx(i).toFixed(1)},${gy(v).toFixed(1)}`).join(' ');
  // gradient fill under line
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 130 }} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.15} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Subtle grid */}
      {[0, 0.5, 1].map(p => <line key={p} x1={px} y1={py + (1 - p) * ch} x2={W - px} y2={py + (1 - p) * ch} stroke="#f0f0f0" strokeWidth={0.5} />)}
      {/* Confidence band */}
      {band && <path d={band} fill={col} opacity={0.05} />}
      {/* Area fill */}
      <path d={area} fill={`url(#${gradId})`} />
      {/* Main line */}
      <path d={line} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points + hover zones */}
      {vals.map((v, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }}>
          <rect x={gx(i) - 25} y={0} width={50} height={H} fill="transparent" />
          {/* Hover line */}
          {hover === i && <line x1={gx(i)} y1={py} x2={gx(i)} y2={py + ch} stroke="#d4d4d8" strokeWidth={0.7} strokeDasharray="3,3" />}
          {/* Dot */}
          <circle cx={gx(i)} cy={gy(v)} r={hover === i ? 4.5 : 2.5} fill={i === 0 ? '#3b82f6' : col} stroke="white" strokeWidth={hover === i ? 2 : 1} className="transition-all duration-100" />
          {/* Day labels */}
          <text x={gx(i)} y={H - 2} textAnchor="middle" fontSize={7.5} fill="#c4c4c4" fontFamily="system-ui">{days[i]?.replace('Day ', 'D')}</text>
          {/* Tooltip */}
          {hover === i && (
            <g>
              <rect x={gx(i) - 38} y={gy(v) - 24} width={76} height={20} rx={6} fill="#18181b" opacity={0.9} />
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
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [stockDetails, setStockDetails] = useState<{ [key: string]: StockInfo }>({});
  const [predictionMap, setPredictionMap] = useState<{ [key: string]: PredictionInfo }>({});
  const [loading, setLoading] = useState(true);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, averageCost: 0 });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const port = await fetchPortfolio();
      setHoldings(port);
      const [idxs, secs] = await Promise.all([fetchIndexes(), fetchSectors()]);
      const d: { [k: string]: StockInfo } = {};
      idxs.forEach((idx: any) => (idx.constituents || []).forEach((c: any) => { if (c.SYMBOL) d[c.SYMBOL] = { name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'], sectorName: d[c.SYMBOL]?.sectorName }; }));
      secs.forEach((s: any) => (s.companies || []).forEach((c: any) => { if (c.SYMBOL) { if (d[c.SYMBOL]) d[c.SYMBOL].sectorName = s.name; else d[c.SYMBOL] = { name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'], sectorName: s.name }; } }));
      setStockDetails(d);
      try { const p = await fetchPortfolioPredictions(); const m: any = {}; (p || []).forEach((x: any) => { m[x.symbol] = x; }); setPredictionMap(m); } catch {}
    } catch (e: any) { setError(e?.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (item: PortfolioItem) => { setEditingSymbol(item.symbol); setEditForm({ quantity: item.quantity, averageCost: item.averageCost || 0 }); setError(''); setMsg(''); };
  const saveEdit = async () => {
    if (!editingSymbol || editForm.quantity <= 0) { setError('Quantity must be > 0'); return; }
    try { const u = await upsertPortfolioItem({ symbol: editingSymbol, quantity: editForm.quantity, averageCost: editForm.averageCost }); setHoldings(u); setEditingSymbol(null); setMsg(`Updated ${editingSymbol}`); setTimeout(() => setMsg(''), 2500); } catch (e: any) { setError(e?.response?.data?.message || 'Failed'); }
  };
  const del = (sym: string) => {
    setConfirmDelete(sym);
  };
  const executeDelete = async () => {
    const sym = confirmDelete;
    if (!sym) return;
    setConfirmDelete(null);
    try { const u = await removePortfolioItem(sym); setHoldings(u); setMsg(`Removed ${sym}`); setTimeout(() => setMsg(''), 2500); } catch (e: any) { setError(e?.response?.data?.message || 'Failed'); }
  };

  // Helpers
  const pos = (c: string) => !c?.startsWith('-') && c !== '0';
  const sigCls = (s: string) => s === 'BUY' ? 'bg-emerald-500' : s === 'SELL' ? 'bg-red-500' : 'bg-amber-500';
  const sigLbl = (s: string) => s === 'BUY' ? 'Buy' : s === 'SELL' ? 'Sell' : 'Hold';
  const retCls = (r: number) => r > 0 ? 'text-emerald-600' : r < 0 ? 'text-red-600' : 'text-gray-500';
  const trustCls = (l: string) => l === 'high' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : l === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
  const sentLbl = (s: number) => s >= 0.5 ? 'Bullish' : s >= 0.2 ? 'Positive' : s >= -0.2 ? 'Neutral' : s >= -0.5 ? 'Negative' : 'Bearish';
  const sentCls = (s: number) => s >= 0.2 ? 'text-emerald-600' : s >= -0.2 ? 'text-amber-600' : 'text-red-600';
  const clean = (t: string) => (t || '').replace(/TFT model forecasts?/gi, 'AI predicts').replace(/TFT/g, 'AI').replace(/Forecast uncertainty:.*?\.\s*/gi, '').replace(/Market sentiment is \w+ \(blended score:.*?\)\.?\s*/gi, '');

  const totInv = holdings.reduce((s, h) => s + h.quantity * (h.averageCost || 0), 0);
  const totCur = holdings.reduce((s, h) => s + h.quantity * parseFloat((stockDetails[h.symbol]?.current || '0').replace(/,/g, '')), 0);
  const totPnL = totCur - totInv;
  const totPct = totInv > 0 ? (totPnL / totInv) * 100 : 0;

  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">My Holdings</h1>
          <p className="text-slate-500 mt-3">{holdings.length} stocks in portfolio</p>
        </div>

        {loading ? <Loader text="Loading holdings..." /> : holdings.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 flex items-center justify-center mx-auto mb-4"><BarChart3 size={28} className="text-blue-500" /></div>
            <p className="text-slate-900 font-bold text-lg">No stocks yet</p>
            <p className="text-slate-500 text-sm mt-2 mb-6">You haven't added any stock holdings yet. Start building your portfolio from the Dashboard.</p>
            <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-blue-500/30 transition-all"><BarChart3 size={16} /> Go to Dashboard</button>
          </div>
        ) : (
          <>
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { label: 'Invested', value: `Rs. ${totInv.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, color: 'text-slate-900', bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200' },
                { label: 'Current Value', value: `Rs. ${totCur.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, color: 'text-slate-900', bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200' },
                { label: 'Total P&L', value: `${totPnL >= 0 ? '+' : ''}Rs. ${totPnL.toLocaleString('en-PK', { maximumFractionDigits: 0 })} (${totPct >= 0 ? '+' : ''}${totPct.toFixed(1)}%)`, color: totPnL >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold', bg: totPnL >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-2xl border px-6 py-5 shadow-sm hover:shadow-md transition-all ${bg}`}>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                  <p className={`text-xl font-bold mt-3 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Holdings */}
            <div className="space-y-4">
              {holdings.map((item, idx) => {
                const info = stockDetails[item.symbol] || {};
                const pred = predictionMap[item.symbol];
                const isExp = expandedSymbol === item.symbol;
                const isEdit = editingSymbol === item.symbol;
                const curP = parseFloat((info.current || '0').replace(/,/g, ''));
                const inv = item.quantity * (item.averageCost || 0);
                const curV = item.quantity * curP;
                const pnl = curV - inv;

                return (
                  <div key={item.symbol} className={`bg-gradient-to-br from-white to-slate-50/50 rounded-2xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${isExp ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                    {isEdit ? (
                      /* Edit mode */
                      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50/30">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <span className="text-lg font-bold text-slate-900">Edit {item.symbol}</span>
                            <p className="text-sm text-slate-500 mt-1">Update holding details</p>
                          </div>
                          <button onClick={() => setEditingSymbol(null)} className="p-2 rounded-lg hover:bg-white text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <label className="text-xs text-slate-600 font-semibold mb-2.5 block uppercase tracking-wide">Quantity</label>
                            <input type="number" min="1" value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600 font-semibold mb-2.5 block uppercase tracking-wide">Avg Cost (Rs)</label>
                            <input type="number" min="0" step="0.01" value={editForm.averageCost} onChange={e => setEditForm({ ...editForm, averageCost: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all" />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={saveEdit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 transition-all"><CheckCircle2 size={16} /> Save</button>
                          <button onClick={() => setEditingSymbol(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Main row */}
                        <div className="px-6 py-5 cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setExpandedSymbol(isExp ? null : item.symbol)}>
                          <div className="flex items-center gap-5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-slate-900">{item.symbol}</span>
                                {pred && <span className={`px-2.5 py-1 rounded-md text-xs font-bold text-white leading-snug ${sigCls(pred.signal)}`}>{sigLbl(pred.signal)}</span>}
                              </div>
                              <p className="text-sm text-slate-400 truncate mt-1">{info.name || item.symbol} • {item.quantity} shares</p>
                            </div>
                            <div className="hidden sm:block text-right mr-4">
                              <p className={`text-base font-bold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pnl >= 0 ? '+' : ''}Rs. {pnl.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                              <p className="text-sm text-slate-400 mt-1">{inv > 0 ? `${((pnl / inv) * 100).toFixed(1)}%` : '--'}</p>
                            </div>
                            <div className="text-right mr-3">
                              <p className="text-lg font-bold text-slate-900">Rs. {info.current || '0'}</p>
                              <p className={`text-sm font-semibold mt-1 ${pos(info.change || '0') ? 'text-emerald-500' : 'text-red-500'}`}>
                                {pos(info.change || '0') ? '+' : ''}{info.change} ({info.percentChange})
                              </p>
                            </div>
                            <svg className={`w-5 h-5 text-slate-300 shrink-0 transition-transform duration-300 ${isExp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExp && (
                          <div className="border-t border-slate-100 px-6 py-6 space-y-6 bg-gradient-to-b from-slate-50/50 to-white animate-fade-in">
                            {/* Holding stats */}
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 mb-4">Holding Details</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                  { label: 'Quantity', val: item.quantity.toLocaleString() },
                                  { label: 'Avg Cost', val: `Rs. ${(item.averageCost || 0).toFixed(2)}` },
                                  { label: 'Invested', val: `Rs. ${inv.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                                  { label: 'Current Val', val: `Rs. ${curV.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                                ].map(s => (
                                  <div key={s.label} className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center hover:shadow-sm transition-all">
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                                    <p className="text-sm font-bold text-slate-900 mt-2">{s.val}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {pred ? (
                              <>
{/* AI Prediction Section */}
                            {pred && (
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <Brain size={16} className="text-blue-500" />
                                  <h3 className="text-sm font-semibold text-slate-900">AI Prediction</h3>
                                  {pred.dataAsOf && <span className="text-xs text-slate-400 ml-auto">as of {pred.dataAsOf}</span>}
                                </div>

                                {/* Prediction metrics */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Signal</p>
                                    <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-md text-xs font-bold text-white ${sigCls(pred.signal)}`}>
                                      {pred.signal === 'BUY' ? <TrendingUp size={12} /> : pred.signal === 'SELL' ? <TrendingDown size={12} /> : <Target size={12} />}
                                      {sigLbl(pred.signal)}
                                    </span>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Confidence</p>
                                    <p className="text-base font-bold text-slate-800 mt-2">{pred.confidence?.toFixed(1)}%</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Target</p>
                                    <p className={`text-base font-bold mt-2 ${retCls(pred.predictedReturn)}`}>Rs. {pred.predictedPrice?.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Return</p>
                                    <p className={`text-base font-bold mt-2 ${retCls(pred.predictedReturn)}`}>{pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%</p>
                                  </div>
                                </div>

                                {/* Trust / Sector / Range */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className={`rounded-lg border px-4 py-3 text-center ${trustCls(pred.trustLevel || 'low')}`}>
                                    <div className="flex items-center justify-center gap-1">
                                      <ShieldCheck size={14} />
                                      <p className="text-xs font-medium uppercase tracking-wide">Trust</p>
                                    </div>
                                    <p className="text-sm font-bold capitalize mt-2">{pred.trustLevel || 'N/A'}</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-400">
                                      <Layers size={14} />
                                      <p className="text-xs font-medium uppercase tracking-wide">Sector</p>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mt-2">{pred.sector || info.sectorName || '—'}</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-400">
                                      <Gauge size={14} />
                                      <p className="text-xs font-medium uppercase tracking-wide">Range</p>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mt-2">{pred.priceRange ? `${pred.priceRange.low?.toFixed(0)} – ${pred.priceRange.high?.toFixed(0)}` : '—'}</p>
                                  </div>
                                </div>

                                {/* 7-Day Direction Bar */}
                                {pred.forecastDays && (
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">7-Day Direction</span>
                                      <div className="flex items-center gap-4 text-xs text-slate-600">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> {pred.forecastDays.bullish} Bull</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {pred.forecastDays.neutral} Neutral</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> {pred.forecastDays.bearish} Bear</span>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 h-3 rounded-lg overflow-hidden bg-slate-100">
                                      {Array.from({ length: pred.forecastDays.bullish || 0 }).map((_, i) => <div key={`b${i}`} className="flex-1 bg-emerald-400" />)}
                                      {Array.from({ length: pred.forecastDays.neutral || 0 }).map((_, i) => <div key={`n${i}`} className="flex-1 bg-amber-400" />)}
                                      {Array.from({ length: pred.forecastDays.bearish || 0 }).map((_, i) => <div key={`d${i}`} className="flex-1 bg-red-400" />)}
                                    </div>
                                  </div>
                                )}

{/* Price Forecast Chart */}
                                {pred.priceForecast7d?.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                      <BarChart3 size={16} className="text-slate-400" />
                                      Price Forecast (7 Days)
                                    </h3>
                                    <div className="bg-white rounded-xl border border-slate-100 p-6">
                                      <ForecastChart forecast={pred.priceForecast7d} quantiles={pred.quantileForecast7d} currentPrice={curP} />
                                    </div>
                                  </div>
                                )}
                                  </div>
                                )}

                                {/* Sentiment Section */}
                                {pred.sentiment && (
                                  <div className="bg-white rounded-lg border border-slate-100 px-4 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Newspaper size={14} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Market Sentiment</span>
                                      </div>
                                      <span className={`text-xs font-bold ${sentCls(pred.sentiment.score)}`}>{sentLbl(pred.sentiment.score)} ({(pred.sentiment.score * 100).toFixed(0)}%)</span>
                                    </div>
                                    {pred.sentiment.reasoning && <p className="text-sm text-slate-600 leading-relaxed mb-3">{pred.sentiment.reasoning}</p>}
                                    {pred.sentiment.key_headlines?.length > 0 && (
                                      <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">Key Headlines:</p>
                                        {pred.sentiment.key_headlines.slice(0, 3).map((h, i) => (
                                          <p key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-slate-200">{h}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Risk Factors */}
                                {pred.riskFactors?.length > 0 && (
                                  <div className="rounded-lg border border-red-200 bg-red-50/60 px-4 py-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <AlertTriangle size={14} className="text-red-500" />
                                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Risk Factors</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {pred.riskFactors.map((r, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-700 font-medium">{r}</span>)}
                                    </div>
                                  </div>
                                )}

                                {/* AI Analysis */}
                                {pred.llmReasoning && (
                                  <div className={`rounded-lg border px-4 py-4 ${pred.signal === 'BUY' ? 'bg-emerald-50/60 border-emerald-200' : pred.signal === 'SELL' ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <Brain size={14} className={`${pred.signal === 'BUY' ? 'text-emerald-600' : pred.signal === 'SELL' ? 'text-red-600' : 'text-amber-600'}`} />
                                      <span className={`text-xs font-semibold uppercase tracking-wide ${pred.signal === 'BUY' ? 'text-emerald-700' : pred.signal === 'SELL' ? 'text-red-700' : 'text-amber-700'}`}>AI Analysis</span>
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-700">{clean(pred.llmReasoning)}</p>
                                  </div>
                                )}

                                {/* Trust Note */}
                                {pred.trustNote && (
                                  <p className="text-xs text-slate-500 italic px-4 py-2 rounded-lg bg-slate-50 border border-slate-100">{pred.trustNote}</p>
                                )}
                              </>
                            ) : (
                              <div className="text-center py-8 px-4">
                                <BarChart3 size={28} className="text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No AI prediction available</p>
                                <p className="text-xs text-slate-400 mt-1">Prediction will appear once analysis is complete</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                              <button onClick={e => { e.stopPropagation(); startEdit(item); }} className="flex-1 px-4 py-3 text-sm font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors">
                                <Pencil size={16} /> Edit
                              </button>
                              <button onClick={e => { e.stopPropagation(); del(item.symbol); }} className="flex-1 px-4 py-3 text-sm font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center gap-2 transition-colors">
                                <Trash2 size={16} /> Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
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
