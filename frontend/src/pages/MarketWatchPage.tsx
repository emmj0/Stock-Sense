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
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold">
              Market Watch
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl">
              Follow real-time stock movements across all indexes and sectors
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Symbol
                </label>
                <input
                  type="text"
                  placeholder="e.g., TELE, FNEL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full input"
                />
              </div>

              {/* Index Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Index
                </label>
                <select
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(e.target.value)}
                  className="w-full input"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Sector
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full input"
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
                className="btn btn-secondary text-sm"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600">Loading market data...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
            <p className="text-gray-600">No stocks found matching your filters</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {/* Table wrapper for responsive scrolling */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Symbol
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Current
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Change
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Change %
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      High
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Low
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Open
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStocks.map((stock) => (
                    <tr
                      key={stock._id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {stock.SYMBOL}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                        {stock.CURRENT}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-semibold ${
                          isPositive(stock.CHANGE)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isPositive(stock.CHANGE) ? '+' : ''}{stock.CHANGE}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-semibold ${
                          isPositive(stock['CHANGE (%)'])
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isPositive(stock['CHANGE (%)']) ? '+' : ''}{stock['CHANGE (%)']}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {stock.HIGH}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {stock.LOW}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {stock.OPEN}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {stock.VOLUME}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with count */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {filteredStocks.length} of {stocks.length} stocks
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
