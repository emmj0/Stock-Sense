import { useEffect, useState, useMemo } from 'react';
import { fetchMarketWatch, fetchIndexes, fetchSectors } from '../api';
import { Loader } from '../components/Loader';
import { BarChart3, Search, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/ui';

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [stocksData, indexesData, sectorsData] = await Promise.all([
          fetchMarketWatch(), fetchIndexes(), fetchSectors(),
        ]);
        setStocks(stocksData);
        if (indexesData && indexesData.length > 0) {
          setIndexes([...new Set(indexesData.map((i: any) => i.name || i.INDEX || i.index || ''))].filter(Boolean) as string[]);
        } else {
          setIndexes([...new Set(stocksData.flatMap((s: Stock) => s.index || []))] as string[]);
        }
        if (sectorsData && sectorsData.length > 0) {
          setSectors([...new Set(sectorsData.map((s: any) => s.name || s.SECTOR || ''))].filter(Boolean) as string[]);
        } else {
          setSectors([...new Set(stocksData.flatMap((s: Stock) => s.sector || []))] as string[]);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedIndex && !selectedSector) return;
    const loadFilteredData = async () => {
      setLoading(true);
      try {
        let data: Stock[] = [];
        if (selectedIndex && selectedSector) {
          const indexData = await fetchMarketWatch('index', selectedIndex);
          const sectorData = await fetchMarketWatch('sector', selectedSector);
          data = indexData.filter((stock: Stock) => sectorData.some((s: Stock) => s._id === stock._id));
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

  const filteredStocks = useMemo(() => {
    if (!searchTerm) return stocks;
    return stocks.filter((stock) => stock.SYMBOL.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stocks, searchTerm]);

  const handleResetFilters = () => { setSelectedIndex(''); setSelectedSector(''); setSearchTerm(''); };
  const isPositive = (change: string) => parseFloat(change) > 0;
  const hasFilters = selectedIndex || selectedSector || searchTerm;

  return (
    <div className="page">
      <PageHeader
        icon={BarChart3}
        title="Market Watch"
        subtitle="Follow real-time stock movements across every index and sector"
        accent="sky"
      />

      {/* Filters */}
      <div className="card p-4 mb-5 reveal">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search symbol…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input pl-10" />
          </div>
          <select value={selectedIndex} onChange={(e) => setSelectedIndex(e.target.value)} className="input lg:w-52">
            <option value="">All Indexes</option>
            {indexes.map((index) => <option key={index} value={index}>{index}</option>)}
          </select>
          <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} className="input lg:w-52">
            <option value="">All Sectors</option>
            {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </select>
          {hasFilters && (
            <button onClick={handleResetFilters} className="btn btn-secondary"><RotateCcw size={15} /> Reset</button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm mb-5">{error}</div>}

      {loading ? (
        <div className="py-12"><Loader text="Loading market data..." /></div>
      ) : filteredStocks.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No stocks found matching your filters</p>
        </div>
      ) : (
        <div className="card overflow-hidden reveal">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-semibold">Symbol</th>
                  <th className="px-5 py-3 font-semibold text-right">Current</th>
                  <th className="px-5 py-3 font-semibold text-right">Change</th>
                  <th className="px-5 py-3 font-semibold text-right">% Chg</th>
                  <th className="px-5 py-3 font-semibold text-right hidden md:table-cell">High</th>
                  <th className="px-5 py-3 font-semibold text-right hidden md:table-cell">Low</th>
                  <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Open</th>
                  <th className="px-5 py-3 font-semibold text-right hidden sm:table-cell">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStocks.map((stock) => {
                  const up = isPositive(stock.CHANGE);
                  return (
                    <tr key={stock._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-sky-600">{stock.SYMBOL}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900 font-mono">{stock.CURRENT}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold font-mono ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{stock.CHANGE}</td>
                      <td className="px-5 py-3.5 text-right"><span className={`pill ${up ? 'pill-up' : 'pill-down'} !py-0.5`}>{up ? '+' : ''}{stock['CHANGE (%)']}</span></td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono hidden md:table-cell">{stock.HIGH}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono hidden md:table-cell">{stock.LOW}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono hidden lg:table-cell">{stock.OPEN}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono hidden sm:table-cell">{stock.VOLUME}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60">
            <p className="text-xs text-slate-500">Showing {filteredStocks.length} of {stocks.length} stocks</p>
          </div>
        </div>
      )}
    </div>
  );
}
