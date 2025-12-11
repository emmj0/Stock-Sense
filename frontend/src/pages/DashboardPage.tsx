import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStocks, upsertPortfolioItem, fetchRecommendations } from '../api';
import { TableSkeletonLoader } from '../components/Loader';
import { HiOutlineX } from 'react-icons/hi';
import type { Stock, Recommendations } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const allowedSymbols = useMemo(
    () => new Set([
      'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
      'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
      'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL'
    ]),
    []
  );
  const [search, setSearch] = useState('');
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [averageCost, setAverageCost] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<any | null>(null);

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

  useEffect(() => {
    const loadRecs = async () => {
      setRecsLoading(true);
      try {
        const data = await fetchRecommendations(5);
        setRecs(data);
      } catch (err: any) {
        console.error('Unable to load recommendations', err);
      } finally {
        setRecsLoading(false);
      }
    };
    loadRecs();
  }, []);

  const filteredStocks = useMemo(() => {
    const base = stocks.filter((s) => allowedSymbols.has(s.symbol));
    if (!search) return base;
    return base.filter((s) => s.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [search, stocks, allowedSymbols]);

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-black">
              Portfolio Dashboard
            </h1>
            <button
              onClick={() => navigate('/holdings')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Holdings
            </button>
          </div>
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

        {/* Top Recommendations */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-black">Top Recommendations</h2>
              <p className="text-sm text-gray-600">Model-driven top buys and sells</p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
              Top {recs?.topN || 5}
            </span>
          </div>

          {recsLoading ? (
            <div className="p-6 text-sm text-gray-600">Loading recommendations...</div>
          ) : recs ? (
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-6">
                <h3 className="text-base font-semibold text-green-700 mb-3">Top Buys</h3>
                {recs.topBuys?.length ? (
                  <ul className="space-y-3">
                    {recs.topBuys.map((item: any, idx: number) => (
                      <li
                        key={idx}
                        onClick={() => setSelectedRec({ ...item, type: 'BUY' })}
                        className="flex items-start justify-between p-3 rounded-lg bg-green-50 border border-green-100 cursor-pointer hover:bg-green-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-green-900">{item.symbol || item.ticker || 'N/A'}</p>
                            {item.confidence !== undefined && (
                              <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-0.5 rounded">
                                {item.confidence.toFixed(2)}% conf
                              </span>
                            )}
                          </div>
                          {item.reason && <p className="text-xs text-green-800 mt-1 line-clamp-2">{item.reason}</p>}
                          {(item.predicted_return !== undefined || item.predicted_price !== undefined) && (
                            <div className="flex gap-3 mt-2 text-xs text-green-700">
                              {item.predicted_return !== undefined && (
                                <span>Return: {item.predicted_return.toFixed(2)}%</span>
                              )}
                              {item.predicted_price !== undefined && (
                                <span>Target: Rs {item.predicted_price.toFixed(2)}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {item.score !== undefined && (
                          <span className="text-xs font-semibold text-green-800 bg-white px-2 py-1 rounded-full border border-green-200 ml-2">
                            {(item.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">No buy recommendations available.</p>
                )}
              </div>

              <div className="p-6">
                <h3 className="text-base font-semibold text-red-700 mb-3">Top Sells</h3>
                {recs.topSells?.length ? (
                  <ul className="space-y-3">
                    {recs.topSells.map((item: any, idx: number) => (
                      <li
                        key={idx}
                        onClick={() => setSelectedRec({ ...item, type: 'SELL' })}
                        className="flex items-start justify-between p-3 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-red-900">{item.symbol || item.ticker || 'N/A'}</p>
                            {item.confidence !== undefined && (
                              <span className="text-xs font-medium text-red-700 bg-red-200 px-2 py-0.5 rounded">
                                {item.confidence.toFixed(2)}% conf
                              </span>
                            )}
                          </div>
                          {item.reason && <p className="text-xs text-red-800 mt-1 line-clamp-2">{item.reason}</p>}
                          {(item.predicted_return !== undefined || item.predicted_price !== undefined) && (
                            <div className="flex gap-3 mt-2 text-xs text-red-700">
                              {item.predicted_return !== undefined && (
                                <span>Return: {item.predicted_return.toFixed(2)}%</span>
                              )}
                              {item.predicted_price !== undefined && (
                                <span>Target: Rs {item.predicted_price.toFixed(2)}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {item.score !== undefined && (
                          <span className="text-xs font-semibold text-red-800 bg-white px-2 py-1 rounded-full border border-red-200 ml-2">
                            {(item.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">No sell recommendations available.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-600">No recommendations available.</div>
          )}
        </div>

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

        {/* Stocks Table */}
        <div className="grid gap-8 lg:grid-cols-1">
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

          {/* Recommendation Details Modal */}
          {selectedRec && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setSelectedRec(null)}
              />
              
              <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className={`px-6 sm:px-8 py-6 flex items-center justify-between ${
                  selectedRec.type === 'BUY' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-rose-600'
                }`}>
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">
                      {selectedRec.type === 'BUY' ? 'Buy Recommendation' : 'Sell Recommendation'}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      {selectedRec.symbol || selectedRec.ticker || 'N/A'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedRec(null)}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <HiOutlineX className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedRec.score !== undefined && (
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Score</p>
                        <p className="text-2xl font-bold text-gray-900">{(selectedRec.score * 100).toFixed(1)}%</p>
                      </div>
                    )}
                    {selectedRec.confidence !== undefined && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Confidence</p>
                        <p className="text-2xl font-bold text-blue-900">{selectedRec.confidence.toFixed(2)}%</p>
                      </div>
                    )}
                    {selectedRec.current_price !== undefined && (
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Current Price</p>
                        <p className="text-2xl font-bold text-indigo-900">Rs {selectedRec.current_price.toFixed(2)}</p>
                      </div>
                    )}
                    {selectedRec.predicted_price !== undefined && (
                      <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Target Price</p>
                        <p className="text-2xl font-bold text-purple-900">Rs {selectedRec.predicted_price.toFixed(2)}</p>
                      </div>
                    )}
                    {selectedRec.predicted_return !== undefined && (
                      <div className={`p-4 rounded-xl border-2 ${
                        selectedRec.predicted_return >= 0 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                          selectedRec.predicted_return >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>Expected Return</p>
                        <p className={`text-2xl font-bold ${
                          selectedRec.predicted_return >= 0 ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {selectedRec.predicted_return >= 0 ? '+' : ''}{selectedRec.predicted_return.toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {selectedRec.ensemble_agreement !== undefined && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Model Agreement</p>
                        <p className="text-2xl font-bold text-amber-900">{selectedRec.ensemble_agreement.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  {selectedRec.reason && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Analysis</p>
                      <p className="text-sm text-gray-900 leading-relaxed">{selectedRec.reason}</p>
                    </div>
                  )}

                  {/* Technical Indicators */}
                  {selectedRec.technical_indicators && Object.keys(selectedRec.technical_indicators).length > 0 && (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Technical Indicators</p>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedRec.technical_indicators).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="text-xs font-medium text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-bold text-gray-900">
                              {typeof value === 'number' ? value.toFixed(2) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Data */}
                  {selectedRec.prediction_date && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Prediction Date: {selectedRec.prediction_date}</span>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedRec(null)}
                    className="w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

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
