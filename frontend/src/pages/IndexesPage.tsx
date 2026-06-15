import { useState, useEffect, useMemo } from 'react';
import { fetchIndexes, fetchIndexByName } from '../api';
import { ChevronDown, TrendingUp, TrendingDown, BarChart3, Search, Info, Star } from 'lucide-react';
import { Loader } from '../components/Loader';
import { PageHeader } from '../components/ui';

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

/* The four headline benchmarks investors watch most — these get the colored cards. */
const HEADLINE = ['KSE100', 'KSE100PR', 'ALLSHR', 'KSE30'];

/* Plain-language descriptions so a beginner understands what each index represents. */
const INDEX_INFO: Record<string, string> = {
  KSE100: "Pakistan's flagship benchmark — the 100 largest companies on the exchange.",
  KSE100PR: 'KSE-100 Price Return — tracks price only, excluding dividends.',
  ALLSHR: 'All Shares — every company listed on the PSX combined.',
  KSE30: 'The 30 most liquid, large free-float stocks.',
  KMI30: '30 leading Shariah-compliant (Islamic) companies.',
  KMIALLSHR: 'All Shariah-compliant listed companies.',
  BKTI: 'Banking sector index.',
  OGTI: 'Oil & gas sector index.',
};

export default function IndexesPage() {
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [indexDetails, setIndexDetails] = useState<{ [key: string]: Index }>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => { loadIndexes(); }, []);

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
    if (expandedIndex === indexName) { setExpandedIndex(null); return; }
    setExpandedIndex(indexName);
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

  const num = (s: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;
  const changeColor = (c: string) => (num(c) > 0 ? 'text-emerald-600' : num(c) < 0 ? 'text-red-600' : 'text-slate-500');
  const pillCls = (c: string) => (num(c) > 0 ? 'pill-up' : num(c) < 0 ? 'pill-down' : 'pill-flat');

  const getIndexGradient = (indexName: string) => {
    const gradients: { [key: string]: string } = {
      KSE100: 'from-sky-500 via-blue-600 to-indigo-600',
      KSE100PR: 'from-orange-500 via-brand-500 to-red-500',
      ALLSHR: 'from-emerald-500 via-teal-500 to-emerald-600',
      KSE30: 'from-violet-500 via-purple-600 to-fuchsia-600',
    };
    return gradients[indexName] || 'from-slate-600 to-slate-700';
  };

  const headline = useMemo(
    () => HEADLINE.map(h => indexes.find(i => i.index === h)).filter(Boolean) as Index[],
    [indexes]
  );

  const filteredAll = useMemo(() => {
    const q = query.trim().toUpperCase();
    return indexes.filter(i => !q || i.index.toUpperCase().includes(q));
  }, [indexes, query]);

  if (loading) {
    return (
      <div className="page flex items-center justify-center min-h-[60vh]">
        <Loader text="Loading indexes..." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        icon={BarChart3}
        title="PSX Indexes"
        subtitle="Track every major Pakistan Stock Exchange index in one place"
        accent="sky"
      />

      {/* ── Headline Indexes ─────────────────────────────── */}
      {headline.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Star size={15} className="text-brand-500 fill-brand-500" />
            <h2 className="text-base font-bold text-slate-900">Headline Indexes</h2>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
            <Info size={13} className="text-slate-400 shrink-0" />
            The main benchmarks most investors watch to judge how the whole market is doing.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {headline.map((idx, i) => {
              const up = num(idx.change) >= 0;
              return (
                <div
                  key={idx._id}
                  className={`reveal stagger-${i + 1} relative overflow-hidden rounded-2xl bg-gradient-to-br ${getIndexGradient(idx.index)} p-5 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold tracking-wide">{idx.index}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                        Benchmark
                      </span>
                    </div>
                    <p className="text-[28px] font-bold mt-2 tracking-tight font-display">{idx.current}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm font-semibold">
                      {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{up ? '+' : ''}{idx.change} ({idx.percent_change})</span>
                    </div>
                    <p className="text-xs text-white/80 mt-3 leading-snug min-h-[2rem]">
                      {INDEX_INFO[idx.index] || 'A Pakistan Stock Exchange index.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── All Indexes ──────────────────────────────────── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-900">All Indexes <span className="text-slate-400 font-medium">({filteredAll.length})</span></h2>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search index…"
              className="input pl-10"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredAll.map((idx, i) => {
            const isExpanded = expandedIndex === idx.index;
            const details = indexDetails[idx.index];
            const constituents = details?.constituents || [];
            const isHeadline = HEADLINE.includes(idx.index);
            const up = num(idx.change) >= 0;

            return (
              <div
                key={idx._id}
                className={`card overflow-hidden transition-all duration-300 reveal ${isExpanded ? 'ring-2 ring-sky-200 border-sky-300' : 'hover:border-slate-300 hover:shadow-card-hover'}`}
                style={{ animationDelay: `${Math.min(i * 0.025, 0.3)}s` }}
              >
                <button onClick={() => toggleIndex(idx.index)} className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors text-left">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getIndexGradient(idx.index)} flex items-center justify-center text-white shadow-md shrink-0`}>
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{idx.index}</h3>
                        {isHeadline && <span className="pill pill-brand !py-0.5">Benchmark</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-[260px]">
                        {INDEX_INFO[idx.index] || (idx.has_constituents ? `${details?.constituents?.length || 'View'} constituents` : 'Composite index')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900 font-display">{idx.current}</p>
                      <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${changeColor(idx.change)}`}>
                        {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{up ? '+' : ''}{idx.change}</span>
                        <span className={`pill ${pillCls(idx.change)} ml-1 !py-0.5`}>{idx.percent_change}</span>
                      </div>
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-0.5 text-xs">
                      <span className="text-slate-400">H <span className="text-emerald-600 font-semibold">{idx.high}</span></span>
                      <span className="text-slate-400">L <span className="text-red-600 font-semibold">{idx.low}</span></span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded constituents */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 animate-fade-in">
                    {/* Mobile High/Low */}
                    <div className="md:hidden grid grid-cols-2 gap-3 p-4">
                      <div className="tile !bg-emerald-50 !border-emerald-200">
                        <p className="tile-label">Day High</p>
                        <p className="tile-value !text-emerald-600">{idx.high}</p>
                      </div>
                      <div className="tile !bg-red-50 !border-red-200">
                        <p className="tile-label">Day Low</p>
                        <p className="tile-value !text-red-600">{idx.low}</p>
                      </div>
                    </div>

                    {loadingDetails === idx.index ? (
                      <div className="p-8"><Loader text="Loading constituents..." size="sm" /></div>
                    ) : constituents.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                              <th className="px-5 py-3 font-semibold">Symbol</th>
                              <th className="px-5 py-3 font-semibold">Company</th>
                              <th className="px-5 py-3 font-semibold text-right">Price</th>
                              <th className="px-5 py-3 font-semibold text-right">Change</th>
                              <th className="px-5 py-3 font-semibold text-right">% Chg</th>
                              <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Weight</th>
                              <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Volume</th>
                              <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Mkt Cap (M)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {constituents.map((stock) => (
                              <tr key={stock.SYMBOL} className="hover:bg-white transition-colors">
                                <td className="px-5 py-3"><span className="font-bold text-sky-600">{stock.SYMBOL}</span></td>
                                <td className="px-5 py-3 text-slate-600 max-w-[220px] truncate">{stock.NAME}</td>
                                <td className="px-5 py-3 text-right font-semibold text-slate-900 font-mono">{stock.CURRENT}</td>
                                <td className={`px-5 py-3 text-right font-semibold font-mono ${changeColor(stock.CHANGE)}`}>{num(stock.CHANGE) >= 0 ? '+' : ''}{stock.CHANGE}</td>
                                <td className="px-5 py-3 text-right"><span className={`pill ${pillCls(stock.CHANGE)} !py-0.5`}>{stock['CHANGE (%)']}</span></td>
                                <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{stock['IDX WTG (%)']}</td>
                                <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{stock.VOLUME}</td>
                                <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{stock['MARKET CAP (M)']}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-sm">No constituent data available for this index</div>
                    )}

                    {details?.scraped_at?.$date && (
                      <div className="px-5 py-2.5 border-t border-slate-100 bg-white">
                        <p className="text-[11px] text-slate-400">Last updated: {new Date(details.scraped_at.$date).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredAll.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No indexes match “{query}”</h3>
            <p className="text-slate-500 text-sm mt-1">Try a different search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
