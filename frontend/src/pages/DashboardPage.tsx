import { useEffect, useMemo, useState } from 'react';
import { fetchStocks, upsertPortfolioItem } from '../api';
import { TableSkeletonLoader } from '../components/Loader';
import { HiOutlineX } from 'react-icons/hi';
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
        <div className="mb-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <input
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border border-gray-300 bg-white text-black text-sm sm:text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Search stocks... (e.g., LPL, PTC)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loadingStocks}
            className="px-6 sm:px-8 py-2.5 sm:py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            {loadingStocks ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-1">
          {/* Stocks Table */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-display font-bold text-black truncate">Available Stocks</h2>
                  <span className="text-xs sm:text-sm font-semibold text-gray-600 bg-gray-200 px-3 py-1 sm:px-4 sm:py-2 rounded-full whitespace-nowrap">
                    {filteredStocks.length}
                  </span>
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
                {loadingStocks ? (
                  <div className="px-4 sm:px-6 py-8">
                    <TableSkeletonLoader />
                  </div>
                ) : filteredStocks.length > 0 ? (
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-gray-700">Symbol</th>
                        <th className="text-right px-2 sm:px-6 py-3 sm:py-4 font-semibold text-gray-700">Price</th>
                        <th className="text-right px-2 sm:px-6 py-3 sm:py-4 font-semibold text-gray-700">Change</th>
                        <th className="text-right px-2 sm:px-6 py-3 sm:py-4 font-semibold text-gray-700 hidden sm:table-cell">Volume</th>
                        <th className="text-right px-2 sm:px-6 py-3 sm:py-4 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-black group-hover:text-blue-600 transition-colors whitespace-nowrap">{stock.symbol}</td>
                          <td className="text-right px-2 sm:px-6 py-3 sm:py-4 text-gray-700 font-medium whitespace-nowrap text-xs sm:text-sm">Rs {stock.current}</td>
                          <td className={`text-right px-2 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm whitespace-nowrap ${
                            stock.changePercent.startsWith('-') ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {stock.changePercent}
                          </td>
                          <td className="text-right px-2 sm:px-6 py-3 sm:py-4 text-gray-600 text-xs font-medium hidden sm:table-cell">{stock.volume}</td>
                          <td className="text-right px-2 sm:px-6 py-3 sm:py-4">
                            <button
                              onClick={() => startAdd(stock.symbol)}
                              className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm whitespace-nowrap"
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-4 sm:px-6 py-12 text-center">
                    <p className="text-gray-600 text-sm sm:text-lg font-medium">
                      {search ? `No stocks found matching "${search}"` : 'No stocks available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Stock Modal */}
          {selectedSymbol && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              {/* Blurred Background */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setSelectedSymbol('')}
              />
              
              {/* Modal */}
              <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 sm:px-8 py-6 flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Add to Holdings</p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">{selectedSymbol}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedSymbol('')}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <HiOutlineX className="w-6 h-6" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantity (shares)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
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
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      placeholder="e.g. 25.50"
                      value={averageCost ?? ''}
                      onChange={(e) => setAverageCost(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={submitAdd}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105"
                    >
                      Add Stock
                    </button>
                    <button
                      onClick={() => setSelectedSymbol('')}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
