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
    <main className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-black mb-2">
            Portfolio Dashboard
          </h1>
          <p className="text-lg text-gray-600">Manage your PSX stocks and track your holdings in real-time</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-green-700 font-medium">{success}</p>
          </div>
        )}

        {/* Search & Controls */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              className="w-full px-6 py-3 rounded-xl border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Search stocks by symbol... (e.g., LPL, PTC)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loadingStocks}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loadingStocks ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Stocks Table */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-black">Available Stocks</h2>
                  <span className="text-sm font-semibold text-gray-600 bg-gray-200 px-4 py-2 rounded-full">
                    {filteredStocks.length} stocks
                  </span>
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {filteredStocks.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-4 font-semibold text-gray-700">Symbol</th>
                        <th className="text-right px-6 py-4 font-semibold text-gray-700">Current Price</th>
                        <th className="text-right px-6 py-4 font-semibold text-gray-700">Change</th>
                        <th className="text-right px-6 py-4 font-semibold text-gray-700">Volume</th>
                        <th className="text-right px-6 py-4 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-black group-hover:text-blue-600 transition-colors">{stock.symbol}</td>
                          <td className="text-right px-6 py-4 text-gray-700 font-medium">Rs {stock.current}</td>
                          <td className={`text-right px-6 py-4 font-semibold ${
                            stock.changePercent.startsWith('-') ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {stock.changePercent}
                          </td>
                          <td className="text-right px-6 py-4 text-gray-600 text-xs font-medium">{stock.volume}</td>
                          <td className="text-right px-6 py-4">
                            <button
                              onClick={() => startAdd(stock.symbol)}
                              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
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
                    <p className="text-gray-600 text-lg font-medium">
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
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h2 className="text-xl font-display font-bold text-black">Your Holdings</h2>
              </div>

              <div className="p-6 max-h-72 overflow-y-auto">
                {portfolio.length > 0 ? (
                  <div className="space-y-3">
                    {portfolio.map((item) => (
                      <div
                        key={item.symbol}
                        className="p-4 rounded-lg bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-black text-lg group-hover:text-blue-600 transition-colors">{item.symbol}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Qty: <span className="font-medium text-gray-700">{item.quantity} shares</span>
                            </p>
                            {item.averageCost && (
                              <p className="text-sm text-gray-600">
                                Avg: <span className="font-medium text-gray-700">Rs {item.averageCost}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemove(item.symbol)}
                            className="text-red-600 hover:text-red-700 font-semibold text-sm hover:bg-red-50 px-3 py-1 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 text-sm font-medium">No holdings yet</p>
                    <p className="text-gray-500 text-xs mt-2">Add stocks from the table above</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add Stock Form */}
            {selectedSymbol && (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-black">Add {selectedSymbol}</h3>
                  <button
                    onClick={() => setSelectedSymbol('')}
                    className="text-gray-500 hover:text-gray-700 text-2xl hover:bg-white px-2 py-1 rounded transition-colors"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantity (shares)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 bg-white text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Average Cost (Optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      placeholder="e.g. 25.50"
                      value={averageCost ?? ''}
                      onChange={(e) => setAverageCost(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={submitAdd}
                      className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setSelectedSymbol('')}
                      className="flex-1 py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
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
