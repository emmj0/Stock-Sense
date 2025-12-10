import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPortfolio, upsertPortfolioItem, removePortfolioItem, fetchIndexes, fetchSectors } from '../api';
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineCheckCircle } from 'react-icons/hi';
import { Loader } from '../components/Loader';

interface PortfolioItem {
  symbol: string;
  quantity: number;
  averageCost?: number;
}

interface StockInfo {
  name?: string;
  current?: string;
  change?: string;
  percentChange?: string;
  indexName?: string;
  sectorName?: string;
  volume?: string;
}

export default function HoldingsPage() {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [stockDetails, setStockDetails] = useState<{ [key: string]: StockInfo }>({});
  const [loading, setLoading] = useState(true);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, averageCost: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadHoldingsWithDetails();
  }, []);

  const loadHoldingsWithDetails = async () => {
    setLoading(true);
    try {
      // Fetch holdings
      const portfolioData = await fetchPortfolio();
      setHoldings(portfolioData);

      // Fetch indexes and sectors data to enrich stock info
      const indexesData = await fetchIndexes();
      const sectorsData = await fetchSectors();

      // Build stock details map
      const details: { [key: string]: StockInfo } = {};

      // Extract stock info from indexes
      indexesData.forEach((index: any) => {
        const indexName = index.index || 'N/A';
        if (index.constituents && Array.isArray(index.constituents)) {
          index.constituents.forEach((constituent: any) => {
            if (constituent.SYMBOL) {
              details[constituent.SYMBOL] = {
                name: constituent.NAME || 'N/A',
                current: constituent.CURRENT || 'N/A',
                change: constituent.CHANGE || '0',
                percentChange: constituent['CHANGE (%)'] || '0%',
                volume: constituent.VOLUME || 'N/A',
                indexName: indexName,
                sectorName: details[constituent.SYMBOL]?.sectorName || 'N/A',
              };
            }
          });
        }
      });

      // Extract stock info from sectors (update sectorName if not already set)
      sectorsData.forEach((sector: any) => {
        const sectorName = sector.name || 'N/A';
        if (sector.companies && Array.isArray(sector.companies)) {
          sector.companies.forEach((company: any) => {
            if (company.SYMBOL) {
              if (details[company.SYMBOL]) {
                // Update existing entry with sector name
                details[company.SYMBOL].sectorName = sectorName;
              } else {
                // Create new entry with sector info
                details[company.SYMBOL] = {
                  name: company.NAME || 'N/A',
                  current: company.CURRENT || 'N/A',
                  change: company.CHANGE || '0',
                  percentChange: company['CHANGE (%)'] || '0%',
                  volume: company.VOLUME || 'N/A',
                  indexName: 'N/A',
                  sectorName: sectorName,
                };
              }
            }
          });
        }
      });

      setStockDetails(details);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: PortfolioItem) => {
    setEditingSymbol(item.symbol);
    setEditForm({
      quantity: item.quantity,
      averageCost: item.averageCost || 0,
    });
    setError('');
    setMessage('');
  };

  const saveEdit = async () => {
    if (!editingSymbol) return;
    if (editForm.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setError('');
      const updated = await upsertPortfolioItem({
        symbol: editingSymbol,
        quantity: editForm.quantity,
        averageCost: editForm.averageCost,
      });
      setHoldings(updated);
      setEditingSymbol(null);
      setMessage(`Updated ${editingSymbol} successfully`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update holding');
    }
  };

  const handleDelete = async (symbol: string) => {
    if (!window.confirm(`Are you sure you want to remove ${symbol} from your holdings?`)) return;

    try {
      setError('');
      const updated = await removePortfolioItem(symbol);
      setHoldings(updated);
      setMessage(`Removed ${symbol} from holdings`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete holding');
    }
  };

  const getStockInfo = (symbol: string): StockInfo => {
    return stockDetails[symbol] || { name: 'N/A', current: 'N/A', indexName: 'N/A', sectorName: 'N/A' };
  };

  const isPositiveChange = (change: string): boolean => {
    return !change.startsWith('-') && change !== '0';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header with gradient */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2.5 hover:bg-white rounded-lg transition-all hover:shadow-md text-gray-600"
            >
              <HiOutlineArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                My Holdings
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage and track your PSX stock portfolio with real-time market data</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 sm:p-5 rounded-xl bg-red-50 border border-red-200 shadow-sm flex items-center gap-3 animate-in slide-in-from-top">
            <div className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-red-700 font-medium text-sm sm:text-base">{error}</p>
          </div>
        )}
        {message && (
          <div className="mb-6 p-4 sm:p-5 rounded-xl bg-green-50 border border-green-200 shadow-sm flex items-center gap-3 animate-in slide-in-from-top">
            <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-green-700 font-medium text-sm sm:text-base">{message}</p>
          </div>
        )}

        {/* Holdings Content */}
        {loading ? (
          <Loader text="Loading your holdings..." />
        ) : holdings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 sm:p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-700 text-lg sm:text-xl font-semibold mb-2">No holdings yet</p>
            <p className="text-gray-600 text-sm sm:text-base mb-6">Start building your portfolio by adding stocks from the Dashboard</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {holdings.map((item, idx) => {
              const info = getStockInfo(item.symbol);
              const changeValue = parseFloat(info.change || '0');
              const isPositive = isPositiveChange(info.change || '0');

              return (
                <div
                  key={item.symbol}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                  style={{
                    animation: `slideIn 0.5s ease-out ${idx * 0.1}s both`
                  }}
                >
                  {editingSymbol === item.symbol ? (
                    // Edit Mode
                    <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{item.symbol}</h3>
                        <button
                          onClick={() => setEditingSymbol(null)}
                          className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <HiOutlineX className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })
                            }
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-900 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">Average Cost (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.averageCost}
                            onChange={(e) =>
                              setEditForm({ ...editForm, averageCost: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-900 font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-gray-300">
                        <button
                          onClick={saveEdit}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
                        >
                          <HiOutlineCheckCircle className="w-5 h-5" />
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingSymbol(null)}
                          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="p-6 sm:p-8">
                      {/* Top Section: Stock Header */}
                      <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <span className="text-white text-2xl font-bold">{item.symbol.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{item.symbol}</h3>
                            <p className="text-gray-600 text-sm mt-1">{info.name}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stock Market Data Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Current Price</p>
                          <p className="text-xl sm:text-2xl font-bold text-gray-900">Rs {info.current}</p>
                        </div>

                        <div className={`p-4 rounded-xl border-2 transition-all ${isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>Change</p>
                          <p className={`text-xl sm:text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                            {isPositive ? '+' : ''}{info.change}
                          </p>
                        </div>

                        <div className={`p-4 rounded-xl border-2 transition-all ${isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>% Change</p>
                          <p className={`text-xl sm:text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                            {info.percentChange}
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Volume</p>
                          <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{info.volume}</p>
                        </div>
                      </div>

                      {/* Classification Badges */}
                      <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Index</p>
                          <p className="text-lg font-bold text-indigo-900">{info.indexName}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Sector</p>
                          <p className="text-lg font-bold text-purple-900">{info.sectorName}</p>
                        </div>
                      </div>

                      {/* Your Holdings */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Quantity</p>
                          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{item.quantity}</p>
                        </div>

                        {item.averageCost && (
                          <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Avg Cost</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900">Rs {item.averageCost.toFixed(2)}</p>
                          </div>
                        )}

                        {item.averageCost && (
                          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-300">
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Total Cost</p>
                            <p className="text-2xl sm:text-3xl font-bold text-blue-700">
                              Rs {(item.quantity * item.averageCost).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="flex-1 px-6 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-semibold flex items-center justify-center gap-2 group/btn"
                        >
                          <HiOutlinePencil className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(item.symbol)}
                          className="flex-1 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-semibold flex items-center justify-center gap-2 group/btn"
                        >
                          <HiOutlineTrash className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
