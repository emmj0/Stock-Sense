import { useState, useEffect } from 'react';
import { fetchIndexes, fetchIndexByName } from '../api';
import { HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineRefresh, HiOutlineChartBar } from 'react-icons/hi';
import { Loader, TableSkeletonLoader } from '../components/Loader';

interface Constituent {
  SYMBOL: string;
  NAME: string;
  LDCP: string;
  CURRENT: string;
  CHANGE: string;
  'CHANGE (%)': string;
  'IDX WTG (%)': string;
  'IDX POINT': string;
  VOLUME: string;
  'FREEFLOAT (M)': string;
  'MARKET CAP (M)': string;
}

interface Index {
  _id: string;
  index: string;
  current: string;
  change: string;
  percent_change: string;
  high: string;
  low: string;
  constituents?: Constituent[];
  has_constituents: boolean;
  scraped_at: { $date: string };
}

export default function IndexesPage() {
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [indexDetails, setIndexDetails] = useState<{ [key: string]: Index }>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    loadIndexes();
  }, []);

  const loadIndexes = async () => {
    setLoading(true);
    try {
      const data = await fetchIndexes();
      setIndexes(data);
    } catch (err) {
      console.error('Failed to load indexes:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleIndex = async (indexName: string) => {
    if (expandedIndex === indexName) {
      setExpandedIndex(null);
      return;
    }

    setExpandedIndex(indexName);

    // Load full index details with constituents if not already loaded
    if (!indexDetails[indexName]) {
      setLoadingDetails(indexName);
      try {
        const fullIndex = await fetchIndexByName(indexName);
        setIndexDetails(prev => ({ ...prev, [indexName]: fullIndex }));
      } catch (err) {
        console.error('Failed to load index details:', err);
      } finally {
        setLoadingDetails(null);
      }
    }
  };

  const getChangeColor = (change: string) => {
    const value = parseFloat(change.replace(/,/g, ''));
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getChangeBg = (change: string) => {
    const value = parseFloat(change.replace(/,/g, ''));
    if (value > 0) return 'bg-green-50 border-green-200';
    if (value < 0) return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getIndexGradient = (indexName: string) => {
    const gradients: { [key: string]: string } = {
      'KSE100': 'from-blue-600 to-indigo-600',
      'KSE30': 'from-purple-600 to-pink-600',
      'ALLSHR': 'from-emerald-600 to-teal-600',
      'KSE100PR': 'from-orange-600 to-red-600',
    };
    return gradients[indexName] || 'from-gray-600 to-slate-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader text="Loading indexes..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PSX Indexes</h1>
              <p className="mt-2 text-gray-600">Track all major Pakistan Stock Exchange indexes</p>
            </div>
            <button
              onClick={loadIndexes}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <HiOutlineRefresh className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Index Cards Overview */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {indexes.map((idx) => (
              <div
                key={idx._id}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getIndexGradient(idx.index)} p-5 text-white shadow-lg`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
                
                <div className="relative z-10">
                  <p className="text-sm font-medium text-white/80">{idx.index}</p>
                  <p className="text-2xl font-bold mt-1">{idx.current}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {parseFloat(idx.change) >= 0 ? (
                      <HiOutlineTrendingUp className="w-4 h-4" />
                    ) : (
                      <HiOutlineTrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {parseFloat(idx.change) >= 0 ? '+' : ''}{idx.change} ({idx.percent_change})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Indexes List with Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {indexes.map((idx) => {
            const isExpanded = expandedIndex === idx.index;
            const details = indexDetails[idx.index];
            const constituents = details?.constituents || [];

            return (
              <div
                key={idx._id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Index Header */}
                <button
                  onClick={() => toggleIndex(idx.index)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getIndexGradient(idx.index)} flex items-center justify-center text-white shadow-lg`}>
                      <HiOutlineChartBar className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-bold text-gray-900">{idx.index}</h3>
                      <p className="text-sm text-gray-500">
                        {idx.has_constituents ? `${details?.constituents?.length || '...'} constituents` : 'No constituents'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Price Info */}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{idx.current}</p>
                      <div className={`flex items-center justify-end gap-1 ${getChangeColor(idx.change)}`}>
                        {parseFloat(idx.change) >= 0 ? (
                          <HiOutlineTrendingUp className="w-4 h-4" />
                        ) : (
                          <HiOutlineTrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-sm font-semibold">
                          {parseFloat(idx.change) >= 0 ? '+' : ''}{idx.change}
                        </span>
                        <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${getChangeBg(idx.change)}`}>
                          {idx.percent_change}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block text-right">
                      <p className="text-sm text-gray-500">High</p>
                      <p className="text-lg font-semibold text-green-600">{idx.high}</p>
                    </div>

                    <div className="hidden md:block text-right">
                      <p className="text-sm text-gray-500">Low</p>
                      <p className="text-lg font-semibold text-red-600">{idx.low}</p>
                    </div>

                    {isExpanded ? (
                      <HiOutlineChevronUp className="w-6 h-6 text-gray-400" />
                    ) : (
                      <HiOutlineChevronDown className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Constituents Table */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* Mobile High/Low */}
                    <div className="md:hidden px-6 py-4 bg-white border-b border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-xl">
                          <p className="text-xs text-gray-500">Day High</p>
                          <p className="text-lg font-bold text-green-600">{idx.high}</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-xl">
                          <p className="text-xs text-gray-500">Day Low</p>
                          <p className="text-lg font-bold text-red-600">{idx.low}</p>
                        </div>
                      </div>
                    </div>

                    {loadingDetails === idx.index ? (
                      <div className="p-8">
                        <Loader text="Loading constituents..." size="sm" />
                      </div>
                    ) : constituents.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 text-left">
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Symbol</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Current</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Change</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Change %</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Idx Wgt</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Idx Points</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Volume</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Mkt Cap (M)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {constituents.map((stock, i) => (
                              <tr key={stock.SYMBOL} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4">
                                  <span className="font-semibold text-blue-600">{stock.SYMBOL}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                  {stock.NAME}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right font-mono">
                                  {stock.CURRENT}
                                </td>
                                <td className={`px-6 py-4 text-sm font-semibold text-right font-mono ${getChangeColor(stock.CHANGE)}`}>
                                  {parseFloat(stock.CHANGE) >= 0 ? '+' : ''}{stock.CHANGE}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getChangeBg(stock.CHANGE)} ${getChangeColor(stock.CHANGE)}`}>
                                    {stock['CHANGE (%)']}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">
                                  {stock['IDX WTG (%)']}
                                </td>
                                <td className={`px-6 py-4 text-sm font-medium text-right font-mono ${getChangeColor(stock['IDX POINT'])}`}>
                                  {parseFloat(stock['IDX POINT']) >= 0 ? '+' : ''}{stock['IDX POINT']}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">
                                  {stock.VOLUME}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">
                                  {stock['MARKET CAP (M)']}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        No constituent data available for this index
                      </div>
                    )}

                    {/* Last Updated */}
                    <div className="px-6 py-3 border-t border-gray-200 bg-gray-100">
                      <p className="text-xs text-gray-500">
                        Last updated: {idx.scraped_at?.$date ? new Date(idx.scraped_at.$date).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {indexes.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineChartBar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No indexes found</h3>
            <p className="text-gray-500 mt-1">Try refreshing the page</p>
          </div>
        )}
      </div>
    </div>
  );
}
