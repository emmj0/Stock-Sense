import { useEffect, useState, useMemo } from 'react';
import { fetchMarketWatch, fetchIndexes, fetchSectors } from '../api';

interface Stock {
  _id: string;
  SYMBOL: string;
  CHANGE: string;
  'CHANGE (%)': string;
  CURRENT: string;
  HIGH: string;
  LDCP: string;
  LOW: string;
  OPEN: string;
  VOLUME: string;
  index: string[];
  sector: string[];
}

export default function MarketWatchPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [indexes, setIndexes] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [stocksData, indexesData, sectorsData] = await Promise.all([
          fetchMarketWatch(),
          fetchIndexes(),
          fetchSectors(),
        ]);

        setStocks(stocksData);

        // Extract unique indexes and sectors from the data or API
        if (indexesData && indexesData.length > 0) {
          const uniqueIndexes = [...new Set(indexesData.map((i: any) => i.name || i.INDEX || ''))].filter(Boolean);
          setIndexes(uniqueIndexes);
        } else {
          // Fallback: extract from stocks
          const uniqueIndexes = [...new Set(stocksData.flatMap((s: Stock) => s.index || []))];
          setIndexes(uniqueIndexes);
        }

        if (sectorsData && sectorsData.length > 0) {
          const uniqueSectors = [...new Set(sectorsData.map((s: any) => s.name || s.SECTOR || ''))].filter(Boolean);
          setSectors(uniqueSectors);
        } else {
          // Fallback: extract from stocks
          const uniqueSectors = [...new Set(stocksData.flatMap((s: Stock) => s.sector || []))];
          setSectors(uniqueSectors);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Fetch filtered data when filters change
  useEffect(() => {
    if (!selectedIndex && !selectedSector) {
      return; // Use initial data
    }

    const loadFilteredData = async () => {
      setLoading(true);
      try {
        let data;
        if (selectedIndex && selectedSector) {
          // Load both, then filter manually
          const indexData = await fetchMarketWatch('index', selectedIndex);
          const sectorData = await fetchMarketWatch('sector', selectedSector);
          // Intersect results
          data = indexData.filter((stock: Stock) =>
            sectorData.some((s: Stock) => s._id === stock._id)
          );
        } else if (selectedIndex) {
          data = await fetchMarketWatch('index', selectedIndex);
        } else if (selectedSector) {
          data = await fetchMarketWatch('sector', selectedSector);
        }
        setStocks(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load filtered data');
      } finally {
        setLoading(false);
      }
    };

    loadFilteredData();
  }, [selectedIndex, selectedSector]);

  // Filter stocks by search term
  const filteredStocks = useMemo(() => {
    if (!searchTerm) return stocks;
    return stocks.filter((stock) =>
      stock.SYMBOL.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stocks, searchTerm]);

  const handleResetFilters = () => {
    setSelectedIndex('');
    setSelectedSector('');
    setSearchTerm('');
  };

  const isPositive = (change: string) => {
    const num = parseFloat(change);
    return num > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050814] via-[#0a0f29] to-[#060817] text-white">
      {/* Header */}
      <div className="relative mx-auto max-w-7xl px-4 py-12 z-10">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black">Market Watch</h1>
          <p className="text-gray-300 text-lg">
            Follow real-time stock movements across all indexes and sectors
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="relative mx-auto max-w-7xl px-4 pb-8 z-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4 backdrop-blur">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Search Symbol
              </label>
              <input
                type="text"
                placeholder="e.g., TELE, FNEL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>

            {/* Index Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Filter by Index
              </label>
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-accent-blue transition-colors"
              >
                <option value="">All Indexes</option>
                {indexes.map((index) => (
                  <option key={index} value={index}>
                    {index}
                  </option>
                ))}
              </select>
            </div>

            {/* Sector Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Filter by Sector
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-accent-blue transition-colors"
              >
                <option value="">All Sectors</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Button */}
          {(selectedIndex || selectedSector || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/50 p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue" />
            <p className="mt-4 text-gray-400">Loading market data...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-gray-400">No stocks found matching your filters</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur">
            {/* Table wrapper for responsive scrolling */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/10">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200">
                      Symbol
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Current
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Change
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Change %
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      High
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Low
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Open
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-200">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredStocks.map((stock) => (
                    <tr
                      key={stock._id}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm font-semibold">
                        {stock.SYMBOL}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-white font-semibold">
                        {stock.CURRENT}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-semibold ${
                          isPositive(stock.CHANGE)
                            ? 'text-accent-green'
                            : 'text-red-400'
                        }`}
                      >
                        {isPositive(stock.CHANGE) ? '+' : ''}{stock.CHANGE}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-semibold ${
                          isPositive(stock['CHANGE (%)'])
                            ? 'text-accent-green'
                            : 'text-red-400'
                        }`}
                      >
                        {isPositive(stock['CHANGE (%)']) ? '+' : ''}{stock['CHANGE (%)']}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {stock.HIGH}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {stock.LOW}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {stock.OPEN}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {stock.VOLUME}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with count */}
            <div className="border-t border-white/10 px-6 py-4 bg-white/5">
              <p className="text-sm text-gray-400">
                Showing {filteredStocks.length} of {stocks.length} stocks
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
