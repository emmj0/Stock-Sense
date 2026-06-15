import { useEffect, useMemo, useState } from 'react';
import { fetchStocks, upsertPortfolioItem } from '../api';
import { TableSkeletonLoader } from '../components/Loader';
import { Toast } from '../components/Toast';
import { X, Search, LayoutDashboard, TrendingUp, TrendingDown, Activity, Plus } from 'lucide-react';
import { PageHeader, StatCard } from '../components/ui';
import type { Stock } from '../types';

export default function DashboardPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState('');
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [averageCost, setAverageCost] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadInitial = async () => {
      setLoadingStocks(true);
      try {
        const stockData = await fetchStocks();
        setStocks(stockData);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load data');
      } finally {
        setLoadingStocks(false);
      }
    };
    loadInitial();
  }, []);

  const filteredStocks = useMemo(() => {
    if (!search) return stocks;
    return stocks.filter((s) => s.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [search, stocks]);

  const pct = (s: Stock) => parseFloat((s.changePercent || '0').replace(/[%,]/g, '')) || 0;
  const { gainers, losers, topGainer, topLoser } = useMemo(() => {
    const g = stocks.filter(s => pct(s) > 0).length;
    const l = stocks.filter(s => pct(s) < 0).length;
    const sorted = [...stocks].sort((a, b) => pct(b) - pct(a));
    return { gainers: g, losers: l, topGainer: sorted[0], topLoser: sorted[sorted.length - 1] };
  }, [stocks]);

  const startAdd = (symbol: string) => {
    setSelectedSymbol(symbol);
    setQuantity(1);
    setAverageCost(undefined);
    setError('');
    setSuccess('');
  };

  const submitAdd = async () => {
    if (!selectedSymbol) return;
    try {
      setError('');
      await upsertPortfolioItem({ symbol: selectedSymbol, quantity, averageCost });
      setSuccess(`Added ${quantity} shares of ${selectedSymbol}`);
      setSelectedSymbol('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={LayoutDashboard}
        title="Portfolio Dashboard"
        subtitle="Browse PSX stocks and add them to your portfolio"
        accent="brand"
      />

      {/* Market snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Stocks Listed" tone="sky" icon={Activity} value={stocks.length || '—'} />
        <StatCard label="Advancing" tone="emerald" icon={TrendingUp} value={gainers} sub={<span className="text-emerald-600">gaining today</span>} />
        <StatCard label="Declining" tone="red" icon={TrendingDown} value={losers} sub={<span className="text-red-600">in the red</span>} />
        <StatCard label="Top Mover" tone="brand" icon={TrendingUp}
          value={topGainer?.symbol || '—'}
          sub={topGainer ? <span className="text-emerald-600">{topGainer.changePercent}</span> : undefined} />
      </div>

      {/* Stocks table */}
      <div className="card overflow-hidden reveal">
        <div className="border-b border-slate-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Available Stocks</h2>
            <span className="pill pill-sky">{filteredStocks.length}</span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search stocks… (e.g. LPL, PTC)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[620px] overflow-y-auto overflow-x-auto">
          {loadingStocks ? (
            <div className="px-5 py-8"><TableSkeletonLoader /></div>
          ) : filteredStocks.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur border-b border-slate-200 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-semibold">Symbol</th>
                  <th className="px-5 py-3 font-semibold text-right">Price</th>
                  <th className="px-5 py-3 font-semibold text-right">Change</th>
                  <th className="px-5 py-3 font-semibold text-right hidden sm:table-cell">Volume</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStocks.map((stock) => {
                  const down = (stock.changePercent || '').startsWith('-');
                  return (
                    <tr key={stock.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5 font-bold text-slate-900 group-hover:text-brand-600 transition-colors whitespace-nowrap">{stock.symbol}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 font-medium font-mono whitespace-nowrap">Rs {stock.current}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={`pill ${down ? 'pill-down' : 'pill-up'} !py-0.5`}>{stock.changePercent}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 text-xs font-mono hidden sm:table-cell">{stock.volume}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => startAdd(stock.symbol)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 shadow-sm shadow-brand-500/25 transition-all text-xs whitespace-nowrap active:scale-95">
                          <Plus size={13} /> Add
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-14 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{search ? `No stocks found matching “${search}”` : 'No stocks available'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Stock Modal */}
      {selectedSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSymbol('')} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-brand-500 to-orange-600 px-7 py-6 flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium mb-0.5">Add to Holdings</p>
                <h2 className="text-2xl font-bold text-white font-display">{selectedSymbol}</h2>
              </div>
              <button onClick={() => setSelectedSymbol('')} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-7 space-y-5">
              <div>
                <label className="eyebrow mb-2 block">Quantity (shares)</label>
                <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">Average Cost (optional)</label>
                <input type="number" min={0} step={0.01} className="input" placeholder="e.g. 25.50" value={averageCost ?? ''} onChange={(e) => setAverageCost(e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={submitAdd} className="btn btn-primary flex-1">Add Stock</button>
                <button onClick={() => setSelectedSymbol('')} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <Toast message={error} type="error" onClose={() => setError('')} />}
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
    </div>
  );
}
