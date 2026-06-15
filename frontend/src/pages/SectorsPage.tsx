import { useState, useEffect } from 'react';
import { fetchSectors, fetchSectorByCode } from '../api';
import {
  ChevronDown, TrendingUp, TrendingDown, MinusCircle, Layers,
  Car, Wrench, Plug, Building2, Landmark, Fuel, Zap, Shirt, Sprout, FlaskConical,
  Pill, Utensils, Leaf, Cpu, FileText, Cog, Truck, ShieldCheck, Briefcase,
  ShoppingBag, Building, Boxes, Factory, Wine, type LucideIcon,
} from 'lucide-react';
import { Loader } from '../components/Loader';
import { PageHeader, StatCard } from '../components/ui';

/* Pick a distinct icon + color for each sector by matching keywords in its name. */
const SECTOR_RULES: { test: RegExp; icon: LucideIcon; grad: string }[] = [
  { test: /auto.*(part|accessor)|part|accessor|tyre|tractor/i, icon: Wrench, grad: 'from-amber-500 to-orange-600' },
  { test: /auto|vehicle|motor|car/i, icon: Car, grad: 'from-rose-500 to-red-600' },
  { test: /cable|electric/i, icon: Plug, grad: 'from-yellow-500 to-amber-600' },
  { test: /cement/i, icon: Building2, grad: 'from-stone-500 to-stone-700' },
  { test: /bank/i, icon: Landmark, grad: 'from-blue-500 to-indigo-600' },
  { test: /oil|gas|petroleum|refin/i, icon: Fuel, grad: 'from-zinc-600 to-slate-700' },
  { test: /power|energy/i, icon: Zap, grad: 'from-yellow-400 to-orange-500' },
  { test: /textile|woollen|synthetic|spinning|weaving|jute/i, icon: Shirt, grad: 'from-fuchsia-500 to-pink-600' },
  { test: /fertil/i, icon: Sprout, grad: 'from-lime-500 to-green-600' },
  { test: /chemical|vanaspati|ghee/i, icon: FlaskConical, grad: 'from-teal-500 to-cyan-600' },
  { test: /pharma|health/i, icon: Pill, grad: 'from-emerald-500 to-teal-600' },
  { test: /food|sugar|dairy|beverage/i, icon: Utensils, grad: 'from-orange-500 to-red-500' },
  { test: /tobacco|cigarette/i, icon: Leaf, grad: 'from-green-600 to-emerald-700' },
  { test: /tech|software|communication|telecom|\bit\b/i, icon: Cpu, grad: 'from-sky-500 to-blue-600' },
  { test: /paper|board/i, icon: FileText, grad: 'from-amber-600 to-yellow-700' },
  { test: /engineering|steel|iron|metal/i, icon: Cog, grad: 'from-slate-500 to-zinc-700' },
  { test: /transport|ship|airline|logistic/i, icon: Truck, grad: 'from-cyan-500 to-blue-600' },
  { test: /insurance|takaful/i, icon: ShieldCheck, grad: 'from-indigo-500 to-violet-600' },
  { test: /invest|leasing|modaraba|financial|securit/i, icon: Briefcase, grad: 'from-violet-500 to-purple-600' },
  { test: /glass|ceramic|wine|sugar mills/i, icon: Wine, grad: 'from-cyan-500 to-teal-600' },
  { test: /leather|tanner/i, icon: ShoppingBag, grad: 'from-amber-700 to-orange-800' },
  { test: /real estate|property|housing/i, icon: Building, grad: 'from-teal-500 to-emerald-600' },
  { test: /miscellaneous|other|closed|mutual/i, icon: Boxes, grad: 'from-slate-500 to-slate-600' },
];

/* Fallback palette — keeps unmatched sectors visually distinct & consistent per code. */
const FALLBACK_GRADS = [
  'from-sky-500 to-blue-600', 'from-violet-500 to-fuchsia-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600', 'from-indigo-500 to-violet-600',
];

function getSectorVisual(name: string, code: string): { Icon: LucideIcon; grad: string } {
  const rule = SECTOR_RULES.find((r) => r.test.test(name || ''));
  if (rule) return { Icon: rule.icon, grad: rule.grad };
  const hash = (code || name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return { Icon: Factory, grad: FALLBACK_GRADS[hash % FALLBACK_GRADS.length] };
}

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

  useEffect(() => { loadSectors(); }, []);

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
    if (expandedSector === code) { setExpandedSector(null); return; }
    setExpandedSector(code);
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

  const num = (s: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;
  const changeColor = (c: string) => (num(c) > 0 ? 'text-emerald-600' : num(c) < 0 ? 'text-red-600' : 'text-slate-500');
  const pillCls = (c: string) => (num(c) > 0 ? 'pill-up' : num(c) < 0 ? 'pill-down' : 'pill-flat');

  if (loading) {
    return <div className="page flex items-center justify-center min-h-[60vh]"><Loader text="Loading sectors..." /></div>;
  }

  const totAdv = sectors.reduce((s, x) => s + parseInt(x.advance || '0'), 0);
  const totDec = sectors.reduce((s, x) => s + parseInt(x.decline || '0'), 0);
  const totUnc = sectors.reduce((s, x) => s + parseInt(x.unchange || '0'), 0);

  return (
    <div className="page">
      <PageHeader icon={Layers} title="PSX Sectors" subtitle="Explore every sector and the companies inside it" accent="emerald" />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Total Sectors" tone="sky" icon={Layers} value={sectors.length} />
        <StatCard label="Advancing" tone="emerald" icon={TrendingUp} value={totAdv} sub={<span className="text-emerald-600">stocks up</span>} />
        <StatCard label="Declining" tone="red" icon={TrendingDown} value={totDec} sub={<span className="text-red-600">stocks down</span>} />
        <StatCard label="Unchanged" tone="slate" icon={MinusCircle} value={totUnc} sub={<span className="text-slate-500">flat</span>} />
      </div>

      {/* Sectors list */}
      <div className="space-y-3">
        {sectors.map((sector, i) => {
          const isExpanded = expandedSector === sector.code;
          const details = sectorDetails[sector.code];
          const companies = details?.companies || [];
          const { Icon, grad } = getSectorVisual(sector.name, sector.code);

          return (
            <div key={sector._id}
              className={`card overflow-hidden transition-all duration-300 reveal ${isExpanded ? 'ring-2 ring-emerald-200 border-emerald-300' : 'hover:shadow-card-hover hover:border-slate-300'}`}
              style={{ animationDelay: `${Math.min(i * 0.025, 0.3)}s` }}>
              <button onClick={() => toggleSector(sector.code)} className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors text-left">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-md shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{sector.name}</h3>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-400">#{sector.code}</span>
                      {sector.has_companies && ` · ${details?.companies?.length || 'View'} companies`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  <div className="hidden md:flex items-center gap-2">
                    <span className="pill pill-up !py-1"><TrendingUp className="w-3.5 h-3.5" />{sector.advance}</span>
                    <span className="pill pill-down !py-1"><TrendingDown className="w-3.5 h-3.5" />{sector.decline}</span>
                    <span className="pill pill-flat !py-1"><MinusCircle className="w-3.5 h-3.5" />{sector.unchange || 0}</span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Mkt Cap</p>
                    <p className="text-sm font-bold text-slate-900">{sector.market_cap} B</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 animate-fade-in">
                  {/* mobile stats */}
                  <div className="md:hidden grid grid-cols-3 gap-3 p-4">
                    <div className="tile !bg-emerald-50 !border-emerald-200"><p className="tile-label">Up</p><p className="tile-value !text-emerald-600">{sector.advance}</p></div>
                    <div className="tile !bg-red-50 !border-red-200"><p className="tile-label">Down</p><p className="tile-value !text-red-600">{sector.decline}</p></div>
                    <div className="tile"><p className="tile-label">Flat</p><p className="tile-value">{sector.unchange || 0}</p></div>
                  </div>

                  {loadingDetails === sector.code ? (
                    <div className="p-8"><Loader text="Loading companies..." size="sm" /></div>
                  ) : companies.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                            <th className="px-5 py-3 font-semibold">Symbol</th>
                            <th className="px-5 py-3 font-semibold">Company</th>
                            <th className="px-5 py-3 font-semibold text-right">Price</th>
                            <th className="px-5 py-3 font-semibold text-right">Change</th>
                            <th className="px-5 py-3 font-semibold text-right">% Chg</th>
                            <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">High</th>
                            <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Low</th>
                            <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Volume</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {companies.map((company) => (
                            <tr key={company.SYMBOL} className="hover:bg-white transition-colors">
                              <td className="px-5 py-3 font-bold text-emerald-600">{company.SYMBOL}</td>
                              <td className="px-5 py-3 text-slate-600 max-w-[220px] truncate">{company.NAME}</td>
                              <td className="px-5 py-3 text-right font-semibold text-slate-900 font-mono">{company.CURRENT}</td>
                              <td className={`px-5 py-3 text-right font-semibold font-mono ${changeColor(company.CHANGE)}`}>{num(company.CHANGE) >= 0 ? '+' : ''}{company.CHANGE}</td>
                              <td className="px-5 py-3 text-right"><span className={`pill ${pillCls(company.CHANGE)} !py-0.5`}>{company['CHANGE (%)']}</span></td>
                              <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{company.HIGH}</td>
                              <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{company.LOW}</td>
                              <td className="px-5 py-3 text-right text-slate-500 font-mono hidden lg:table-cell">{company.VOLUME}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-sm">No company data available for this sector</div>
                  )}

                  {sector.scraped_at?.$date && (
                    <div className="px-5 py-2.5 border-t border-slate-100 bg-white">
                      <p className="text-[11px] text-slate-400">Last updated: {new Date(sector.scraped_at.$date).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sectors.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Layers className="w-7 h-7 text-slate-400" /></div>
            <h3 className="text-base font-semibold text-slate-900">No sectors found</h3>
            <p className="text-slate-500 text-sm mt-1">Try refreshing the page</p>
          </div>
        )}
      </div>
    </div>
  );
}
