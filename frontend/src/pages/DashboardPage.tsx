import { useEffect, useMemo, useState } from 'react';
import { fetchPortfolio, fetchStocks, removePortfolioItem, upsertPortfolioItem } from '../api';
import type { PortfolioItem, Stock } from '../types';

export default function DashboardPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [search, setSearch] = useState('');
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [averageCost, setAverageCost] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadInitial = async () => {
      setLoadingStocks(true);
      setLoadingPortfolio(true);
      try {
        const [stockData, portfolioData] = await Promise.all([fetchStocks(), fetchPortfolio()]);
        setStocks(stockData);
        setPortfolio(portfolioData);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load data');
      } finally {
        setLoadingStocks(false);
        setLoadingPortfolio(false);
      }
    };
    loadInitial();
  }, []);

  const filteredStocks = useMemo(() => {
    if (!search) return stocks;
    return stocks.filter((s) => s.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [search, stocks]);

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
      const updated = await upsertPortfolioItem({ symbol: selectedSymbol, quantity, averageCost });
      setPortfolio(updated);
      setSuccess(`Added ${quantity} shares of ${selectedSymbol}`);
      setSelectedSymbol('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save');
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      setError('');
      const updated = await removePortfolioItem(symbol);
      setPortfolio(updated);
      setSuccess(`Removed ${symbol} from portfolio`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not remove');
    }
  };

  const handleRefresh = async () => {
    setLoadingStocks(true);
    try {
      const data = await fetchStocks(search);
      setStocks(data);
      setSuccess('Stocks refreshed');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not refresh');
    } finally {
      setLoadingStocks(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-bg py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-black text-white mb-2">📊 Portfolio Dashboard</h1>
          <p className="text-lg text-gray-400">Manage your PSX stocks and track your holdings in real-time</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 backdrop-blur flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-accent-red font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-accent-green/20 border border-accent-green/50 backdrop-blur flex items-center gap-3">
            <span className="text-xl">✅</span>
            <p className="text-accent-green font-medium">{success}</p>
          </div>
        )}

        {/* Search & Controls */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/20 to-accent-green/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            <input
              className="relative w-full px-6 py-4 rounded-xl border-2 border-dark-border bg-dark-card text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none transition-all"
              placeholder="🔍 Search stocks by symbol... (e.g., LPL, PTC)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loadingStocks}
            className="px-8 py-4 bg-gradient-to-r from-accent-blue to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-accent-blue/50 disabled:opacity-60 transition-all flex items-center justify-center gap-2 group"
          >
            <span className={loadingStocks ? 'animate-spin' : ''}>🔄</span>
            {loadingStocks ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Stocks Table */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-gradient-to-br from-dark-card/90 to-dark-bg/90 border border-dark-border overflow-hidden backdrop-blur shadow-xl">
              <div className="border-b border-dark-border/50 px-6 py-5 flex items-center justify-between bg-dark-border/20">
                <h2 className="text-2xl font-black text-white">📈 Available Stocks</h2>
                <span className="text-sm font-bold text-accent-blue bg-accent-blue/20 px-4 py-2 rounded-full border border-accent-blue/50">
                  {filteredStocks.length} stocks
                </span>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {filteredStocks.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-dark-border/30 border-b border-dark-border/50 backdrop-blur">
                      <tr>
                        <th className="text-left px-6 py-4 font-bold text-gray-300">Symbol</th>
                        <th className="text-right px-6 py-4 font-bold text-gray-300">Current Price</th>
                        <th className="text-right px-6 py-4 font-bold text-gray-300">Change</th>
                        <th className="text-right px-6 py-4 font-bold text-gray-300">Volume</th>
                        <th className="text-right px-6 py-4 font-bold text-gray-300">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/30">
                      {filteredStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-dark-border/40 transition-colors group">
                          <td className="px-6 py-4 font-bold text-white group-hover:text-accent-blue transition-colors">{stock.symbol}</td>
                          <td className="text-right px-6 py-4 text-gray-300 font-semibold">Rs {stock.current}</td>
                          <td className={`text-right px-6 py-4 font-bold ${
                            stock.changePercent.startsWith('-') ? 'text-accent-red' : 'text-accent-green'
                          }`}>
                            {stock.changePercent}
                          </td>
                          <td className="text-right px-6 py-4 text-gray-400 text-xs font-semibold">{stock.volume}</td>
                          <td className="text-right px-6 py-4">
                            <button
                              onClick={() => startAdd(stock.symbol)}
                              className="px-4 py-2 bg-accent-blue text-white font-bold rounded-lg hover:bg-blue-500 hover:shadow-lg transition-all text-sm"
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-400 text-lg font-semibold">
                      {search ? `No stocks found matching "${search}"` : 'No stocks available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Portfolio & Add Form */}
          <div className="space-y-6">
            {/* Portfolio Section */}
            <div className="rounded-2xl bg-gradient-to-br from-dark-card/90 to-dark-bg/90 border border-dark-border overflow-hidden backdrop-blur shadow-xl">
              <div className="border-b border-dark-border/50 px-6 py-5 bg-dark-border/20">
                <h2 className="text-2xl font-black text-white">💼 Your Holdings</h2>
              </div>

              <div className="p-6 max-h-72 overflow-y-auto">
                {portfolio.length > 0 ? (
                  <div className="space-y-3">
                    {portfolio.map((item) => (
                      <div
                        key={item.symbol}
                        className="p-4 rounded-xl bg-dark-border/40 border border-dark-border/60 hover:border-accent-blue hover:bg-dark-border/60 transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-white text-lg group-hover:text-accent-blue transition-colors">{item.symbol}</p>
                            <p className="text-sm text-gray-400 mt-1">
                              Qty: <span className="font-semibold text-gray-300">{item.quantity} shares</span>
                            </p>
                            {item.averageCost && (
                              <p className="text-sm text-gray-400">
                                Avg: <span className="font-semibold text-gray-300">Rs {item.averageCost}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemove(item.symbol)}
                            className="text-accent-red hover:text-red-400 font-bold text-sm hover:bg-red-500/20 px-3 py-1 rounded-lg transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm font-semibold">No holdings yet</p>
                    <p className="text-gray-600 text-xs mt-2">Add stocks from the table above</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add Stock Form */}
            {selectedSymbol && (
              <div className="rounded-2xl bg-gradient-to-br from-accent-blue/20 via-accent-blue/10 to-dark-card border-2 border-accent-blue/50 p-6 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Add {selectedSymbol}</h3>
                  <button
                    onClick={() => setSelectedSymbol('')}
                    className="text-gray-400 hover:text-gray-300 text-xl hover:bg-dark-border/50 px-2 py-1 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Quantity (shares)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full px-4 py-3 rounded-lg border-2 border-accent-blue/50 bg-dark-bg text-white focus:border-accent-blue focus:outline-none transition-all"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Average Cost (Optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-full px-4 py-3 rounded-lg border-2 border-accent-blue/50 bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none transition-all"
                      placeholder="e.g. 25.50"
                      value={averageCost ?? ''}
                      onChange={(e) => setAverageCost(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={submitAdd}
                      className="flex-1 py-3 bg-gradient-to-r from-accent-blue to-blue-500 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-accent-blue/50 transition-all"
                    >
                      ✅ Save
                    </button>
                    <button
                      onClick={() => setSelectedSymbol('')}
                      className="flex-1 py-3 bg-dark-border text-gray-300 font-bold rounded-lg hover:bg-dark-border/80 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
