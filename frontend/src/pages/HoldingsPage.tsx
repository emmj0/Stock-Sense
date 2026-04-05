import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPortfolio, upsertPortfolioItem, removePortfolioItem, fetchIndexes, fetchSectors, fetchPortfolioPredictions } from '../api';
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineCheckCircle } from 'react-icons/hi';
import { Loader } from '../components/Loader';

interface PortfolioItem { symbol: string; quantity: number; averageCost?: number; }
interface StockInfo { name?: string; current?: string; change?: string; percentChange?: string; sectorName?: string; }
interface PredictionInfo { signal: string; confidence: number; predictedPrice: number; predictedReturn: number; reasoning: string; llmReasoning?: string; forecastDays?: { bullish: number }; trustLevel?: string; }

export default function HoldingsPage() {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [stockDetails, setStockDetails] = useState<{ [key: string]: StockInfo }>({});
  const [predictionMap, setPredictionMap] = useState<{ [key: string]: PredictionInfo }>({});
  const [loading, setLoading] = useState(true);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, averageCost: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const portfolioData = await fetchPortfolio();
      setHoldings(portfolioData);

      const [indexesData, sectorsData] = await Promise.all([fetchIndexes(), fetchSectors()]);
      const details: { [key: string]: StockInfo } = {};

      indexesData.forEach((idx: any) => {
        (idx.constituents || []).forEach((c: any) => {
          if (c.SYMBOL) details[c.SYMBOL] = { name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'], sectorName: details[c.SYMBOL]?.sectorName };
        });
      });
      sectorsData.forEach((sec: any) => {
        (sec.companies || []).forEach((c: any) => {
          if (c.SYMBOL) {
            if (details[c.SYMBOL]) details[c.SYMBOL].sectorName = sec.name;
            else details[c.SYMBOL] = { name: c.NAME, current: c.CURRENT, change: c.CHANGE, percentChange: c['CHANGE (%)'], sectorName: sec.name };
          }
        });
      });
      setStockDetails(details);

      try {
        const preds = await fetchPortfolioPredictions();
        const pMap: { [key: string]: PredictionInfo } = {};
        (preds || []).forEach((p: any) => {
          pMap[p.symbol] = { signal: p.signal, confidence: p.confidence, predictedPrice: p.predictedPrice, predictedReturn: p.predictedReturn, reasoning: p.reasoning, llmReasoning: p.llmReasoning, forecastDays: p.forecastDays, trustLevel: p.trustLevel };
        });
        setPredictionMap(pMap);
      } catch { /* predictions unavailable */ }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: PortfolioItem) => {
    setEditingSymbol(item.symbol);
    setEditForm({ quantity: item.quantity, averageCost: item.averageCost || 0 });
    setError(''); setMessage('');
  };

  const saveEdit = async () => {
    if (!editingSymbol || editForm.quantity <= 0) { setError('Quantity must be greater than 0'); return; }
    try {
      setError('');
      const updated = await upsertPortfolioItem({ symbol: editingSymbol, quantity: editForm.quantity, averageCost: editForm.averageCost });
      setHoldings(updated); setEditingSymbol(null);
      setMessage(`Updated ${editingSymbol}`); setTimeout(() => setMessage(''), 3000);
    } catch (err: any) { setError(err?.response?.data?.message || 'Failed to update'); }
  };

  const handleDelete = async (symbol: string) => {
    if (!window.confirm(`Remove ${symbol} from holdings?`)) return;
    try {
      setError('');
      const updated = await removePortfolioItem(symbol);
      setHoldings(updated);
      setMessage(`Removed ${symbol}`); setTimeout(() => setMessage(''), 3000);
    } catch (err: any) { setError(err?.response?.data?.message || 'Failed to delete'); }
  };

  const isPositive = (change: string) => !change?.startsWith('-') && change !== '0';

  const signalBg = (s: string) => s === 'BUY' ? 'bg-emerald-500' : s === 'SELL' ? 'bg-red-500' : 'bg-amber-500';
  const signalLabel = (s: string) => s === 'BUY' ? 'Buy' : s === 'SELL' ? 'Sell' : 'Hold';
  const returnColor = (r: number) => r > 0 ? 'text-emerald-600 dark:text-emerald-400' : r < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300';

  const cleanReasoning = (text: string) =>
    (text || '').replace(/TFT model forecasts?/gi, 'Our AI predicts').replace(/TFT/g, 'AI')
      .replace(/Forecast uncertainty:.*?\.\s*/gi, '').replace(/Market sentiment is \w+ \(blended score:.*?\)\.?\s*/gi, '');

  // Compute totals
  const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * (h.averageCost || 0)), 0);
  const totalCurrent = holdings.reduce((sum, h) => {
    const price = parseFloat((stockDetails[h.symbol]?.current || '0').replace(/,/g, ''));
    return sum + (h.quantity * price);
  }, 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-dark-bg py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white dark:hover:bg-dark-hover rounded-lg transition-all text-gray-500 dark:text-gray-300">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">My Holdings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">{holdings.length} stocks in your portfolio</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm animate-fade-in">{error}</div>
        )}
        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm animate-fade-in">{message}</div>
        )}

        {loading ? <Loader text="Loading holdings..." /> : holdings.length === 0 ? (
          <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-1">No stocks yet</p>
            <p className="text-gray-500 dark:text-gray-300 text-sm mb-4">Add stocks from the Dashboard to get started</p>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary text-sm">Go to Dashboard</button>
          </div>
        ) : (
          <>
            {/* Portfolio Summary Bar */}
            <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-4 flex flex-wrap gap-6 items-center animate-fade-in">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-300">Invested</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. {totalInvested.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-300">Current Value</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. {totalCurrent.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-300">Total P&L</p>
                <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}Rs. {totalPnL.toLocaleString('en-PK', { maximumFractionDigits: 0 })} ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}%)
                </p>
              </div>
            </div>

            {/* Holdings List */}
            <div className="space-y-3">
              {holdings.map((item, idx) => {
                const info = stockDetails[item.symbol] || {};
                const pred = predictionMap[item.symbol];
                const positive = isPositive(info.change || '0');
                const isExpanded = expandedSymbol === item.symbol;
                const isEditing = editingSymbol === item.symbol;
                const currentPrice = parseFloat((info.current || '0').replace(/,/g, ''));
                const invested = item.quantity * (item.averageCost || 0);
                const currentVal = item.quantity * currentPrice;
                const pnl = currentVal - invested;

                return (
                  <div
                    key={item.symbol}
                    className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden animate-slide-up"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {isEditing ? (
                      /* Edit Mode — compact */
                      <div className="p-4 bg-blue-50/50 dark:bg-dark-surface">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-gray-900 dark:text-white">{item.symbol}</h3>
                          <button onClick={() => setEditingSymbol(null)} className="p-1 rounded hover:bg-white dark:hover:bg-dark-hover text-gray-400">
                            <HiOutlineX className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-3 mb-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-300 mb-1 block">Quantity</label>
                            <input type="number" min="1" value={editForm.quantity}
                              onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-300 mb-1 block">Avg Cost (Rs)</label>
                            <input type="number" min="0" step="0.01" value={editForm.averageCost}
                              onChange={(e) => setEditForm({ ...editForm, averageCost: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1">
                            <HiOutlineCheckCircle className="w-4 h-4" /> Save
                          </button>
                          <button onClick={() => setEditingSymbol(null)} className="px-3 py-2 bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-dark-surface">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Main Row */}
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-dark-hover/50 transition-colors"
                          onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            {/* Left: Symbol + Price */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {item.symbol.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                                  {pred && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${signalBg(pred.signal)}`}>
                                      {signalLabel(pred.signal)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{info.name || item.symbol} &middot; {item.quantity} shares</p>
                              </div>
                            </div>

                            {/* Center: P&L */}
                            <div className="hidden sm:block text-right">
                              <p className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {pnl >= 0 ? '+' : ''}Rs. {pnl.toFixed(0)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-300">
                                {invested > 0 ? `${((pnl / invested) * 100).toFixed(1)}%` : '--'}
                              </p>
                            </div>

                            {/* Right: Current Price + Change */}
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">Rs. {info.current || '0'}</p>
                              <p className={`text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {positive ? '+' : ''}{info.change} ({info.percentChange})
                              </p>
                            </div>

                            {/* Expand arrow */}
                            <svg className={`w-4 h-4 text-gray-300 dark:text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-surface/50 p-4 animate-fade-in">
                            {/* Holdings + Market Info */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              <div className="text-center p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
                                <p className="text-[10px] text-gray-500 dark:text-gray-300 uppercase">Qty</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{item.quantity}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
                                <p className="text-[10px] text-gray-500 dark:text-gray-300 uppercase">Avg Cost</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Rs. {(item.averageCost || 0).toFixed(2)}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
                                <p className="text-[10px] text-gray-500 dark:text-gray-300 uppercase">Invested</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Rs. {invested.toFixed(0)}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
                                <p className="text-[10px] text-gray-500 dark:text-gray-300 uppercase">Current</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Rs. {currentVal.toFixed(0)}</p>
                              </div>
                            </div>

                            {/* AI Prediction — compact */}
                            {pred && (
                              <div className={`p-3 rounded-lg mb-3 ${pred.signal === 'BUY' ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800' : pred.signal === 'SELL' ? 'bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">AI Prediction (7-day)</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${returnColor(pred.predictedReturn)}`}>
                                      {pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-300">target Rs. {pred.predictedPrice?.toFixed(2)}</span>
                                  </div>
                                </div>
                                {pred.llmReasoning && (
                                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {cleanReasoning(pred.llmReasoning || pred.reasoning)}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="flex-1 px-3 py-2 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center gap-1.5">
                                <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(item.symbol); }} className="flex-1 px-3 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center gap-1.5">
                                <HiOutlineTrash className="w-3.5 h-3.5" /> Remove
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
    </main>
  );
}
