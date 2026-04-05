import { useState, useEffect } from 'react';
import { fetchSectors, fetchSectorByCode } from '../api';
import { HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineMinusCircle, HiOutlineRefresh } from 'react-icons/hi';
import { Loader, TableSkeletonLoader } from '../components/Loader';

interface Company {
  SYMBOL: string;
  NAME: string;
  LDCP: string;
  OPEN: string;
  HIGH: string;
  LOW: string;
  CURRENT: string;
  CHANGE: string;
  'CHANGE (%)': string;
  VOLUME: string;
}

interface Sector {
  _id: string;
  code: string;
  name: string;
  advance: string;
  decline: string;
  unchange: string;
  market_cap: string;
  turnover: string;
  companies?: Company[];
  has_companies: boolean;
  scraped_at: { $date: string };
}

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [sectorDetails, setSectorDetails] = useState<{ [key: string]: Sector }>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    setLoading(true);
    try {
      const data = await fetchSectors();
      setSectors(data);
    } catch (err) {
      console.error('Failed to load sectors:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = async (code: string) => {
    if (expandedSector === code) {
      setExpandedSector(null);
      return;
    }

    setExpandedSector(code);

    // Load full sector details with companies if not already loaded
    if (!sectorDetails[code]) {
      setLoadingDetails(code);
      try {
        const fullSector = await fetchSectorByCode(code);
        setSectorDetails(prev => ({ ...prev, [code]: fullSector }));
      } catch (err) {
        console.error('Failed to load sector details:', err);
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
    if (value > 0) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (value < 0) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    return 'bg-gray-50 dark:bg-dark-surface border-gray-200 dark:border-dark-border';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <Loader text="Loading sectors..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Header */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">PSX Sectors</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Explore all sectors and their constituent companies</p>
            </div>
            <button
              onClick={loadSectors}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <HiOutlineRefresh className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-600 font-medium">Total Sectors</p>
              <p className="text-2xl font-bold text-blue-700">{sectors.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
              <p className="text-sm text-green-600 font-medium">Advancing</p>
              <p className="text-2xl font-bold text-green-700">
                {sectors.reduce((sum, s) => sum + parseInt(s.advance || '0'), 0)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
              <p className="text-sm text-red-600 font-medium">Declining</p>
              <p className="text-2xl font-bold text-red-700">
                {sectors.reduce((sum, s) => sum + parseInt(s.decline || '0'), 0)}
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-dark-surface rounded-xl p-4 border border-gray-200 dark:border-dark-border">
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Unchanged</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {sectors.reduce((sum, s) => sum + parseInt(s.unchange || '0'), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sectors List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {sectors.map((sector) => {
            const isExpanded = expandedSector === sector.code;
            const details = sectorDetails[sector.code];
            const companies = details?.companies || [];

            return (
              <div
                key={sector._id}
                className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Sector Header */}
                <button
                  onClick={() => toggleSector(sector.code)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/20">
                      {sector.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{sector.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-300">Code: {sector.code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-4">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <HiOutlineTrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">{sector.advance}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <HiOutlineTrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">{sector.decline}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-surface border border-gray-200 dark:border-dark-border">
                        <HiOutlineMinusCircle className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{sector.unchange || 0}</span>
                      </div>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-gray-500 dark:text-gray-300">Market Cap</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{sector.market_cap} B</p>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-gray-500 dark:text-gray-300">Turnover</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{sector.turnover}</p>
                    </div>

                    {isExpanded ? (
                      <HiOutlineChevronUp className="w-6 h-6 text-gray-400" />
                    ) : (
                      <HiOutlineChevronDown className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Companies Table */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface">
                    {loadingDetails === sector.code ? (
                      <div className="p-8">
                        <Loader text="Loading companies..." size="sm" />
                      </div>
                    ) : companies.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-dark-surface text-left">
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">LDCP</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Current</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Change</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Change %</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">High</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Low</th>
                              <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Volume</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                            {companies.map((company, idx) => (
                              <tr key={company.SYMBOL} className={idx % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-gray-50 dark:bg-dark-surface'}>
                                <td className="px-6 py-4">
                                  <span className="font-semibold text-blue-600">{company.SYMBOL}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                                  {company.NAME}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                  {company.LDCP}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right font-mono">
                                  {company.CURRENT}
                                </td>
                                <td className={`px-6 py-4 text-sm font-semibold text-right font-mono ${getChangeColor(company.CHANGE)}`}>
                                  {parseFloat(company.CHANGE) >= 0 ? '+' : ''}{company.CHANGE}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getChangeBg(company.CHANGE)} ${getChangeColor(company.CHANGE)}`}>
                                    {company['CHANGE (%)']}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-green-600 text-right font-mono">
                                  {company.HIGH}
                                </td>
                                <td className="px-6 py-4 text-sm text-red-600 text-right font-mono">
                                  {company.LOW}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                  {company.VOLUME}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-300">
                        No company data available for this sector
                      </div>
                    )}

                    {/* Mobile Stats (shown in expanded view) */}
                    <div className="md:hidden px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-300">Advancing</p>
                          <p className="text-lg font-bold text-green-600">{sector.advance}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-300">Declining</p>
                          <p className="text-lg font-bold text-red-600">{sector.decline}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-300">Unchanged</p>
                          <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{sector.unchange || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="px-6 py-3 border-t border-gray-200 dark:border-dark-border bg-gray-100 dark:bg-dark-surface">
                      <p className="text-xs text-gray-500 dark:text-gray-300">
                        Last updated: {sector.scraped_at?.$date ? new Date(sector.scraped_at.$date).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sectors.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineTrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No sectors found</h3>
            <p className="text-gray-500 dark:text-gray-300 mt-1">Try refreshing the page</p>
          </div>
        )}
      </div>
    </div>
  );
}
