import { useEffect, useState, useMemo } from 'react';
import { fetchPredictions, fetchRecommendations, fetchPortfolioPredictions } from '../api';
import { useAuth } from '../providers/AuthProvider';
import {
  Brain, TrendingUp, TrendingDown, Target, ShieldCheck, Newspaper, AlertTriangle,
  Search, Sparkles, ArrowRight, Inbox, PlusCircle, BarChart3,
} from 'lucide-react';
import { PageHeader, SectionTitle, StatCard, EmptyState } from '../components/ui';

interface Prediction {
  symbol: string;
  companyName: string;
  sector: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  currentPrice: number;
  predictedPrice: number;
  predictedReturn: number;
  horizonDays: number;
  priceRange: { low: number; high: number };
  forecastDays: { bullish: number; bearish: number; neutral: number };
  strength: number;
  reasoning: string;
  confidenceNote: string | null;
  llmReasoning: string;
  riskFactors: string[];
  sentiment: {
    score: number;
    confidence: number;
    source: string;
    key_headlines: string[];
    reasoning: string;
  };
  trustLevel: string;
  trustNote: string | null;
  priceForecast7d: number[];
  quantileForecast7d: {
    q10: number[];
    q25: number[];
    q50: number[];
    q75: number[];
    q90: number[];
  };
  dataAsOf: string;
  updatedAt: string;
}

interface Recommendation {
  symbol: string;
  sector: string;
  current_price: number;
  predicted_price: number;
  predicted_return: number;
  confidence: number;
  reasoning: string;
}

export default function PredictionsPage() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [portfolioPredictions, setPortfolioPredictions] = useState<Prediction[]>([]);
  const [recommendations, setRecommendations] = useState<{
    topBuys: Recommendation[];
    topSells: Recommendation[];
    summary: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSignal, setFilterSignal] = useState<string>('');
  const [filterSector, setFilterSector] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'all' | 'recommendations'>('portfolio');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [predData, recData] = await Promise.all([
        fetchPredictions(),
        fetchRecommendations(),
      ]);
      setPredictions(predData.predictions || []);
      setRecommendations(recData || null);

      // Fetch portfolio predictions if user is logged in
      try {
        const portfolioData = await fetchPortfolioPredictions();
        setPortfolioPredictions(portfolioData || []);
      } catch {
        // User may not have portfolio stocks
        setPortfolioPredictions([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  // Clean technical jargon from model reasoning for user display
  const cleanReasoning = (text: string) => {
    if (!text) return '';
    return text
      .replace(/TFT model forecasts?/gi, 'Our AI predicts')
      .replace(/TFT/g, 'AI')
      .replace(/blended score: [-\d.]+/gi, '')
      .replace(/blended sentiment/gi, 'market mood')
      .replace(/\(blended score: \)/gi, '')
      .replace(/Forecast uncertainty: [\d.]+% price range \([^)]*\)\.\s*/gi, '')
      .replace(/Market sentiment is (neutral|positive|negative) \(\)\.?\s*/gi, (_, mood) => `Market mood is ${mood}. `)
      .replace(/Market sentiment is (neutral|positive|negative) \(market mood: [-\d.]+\)\.?\s*/gi, (_, mood) => `Market mood is ${mood}. `)
      .replace(/\s+/g, ' ')
      .trim();
  };

  const sectors = useMemo(() => {
    const s = new Set(predictions.map((p) => p.sector).filter(Boolean));
    return Array.from(s).sort();
  }, [predictions]);

  const filtered = useMemo(() => {
    let result = predictions;
    if (filterSignal) result = result.filter((p) => p.signal === filterSignal);
    if (filterSector) result = result.filter((p) => p.sector === filterSector);
    if (searchTerm)
      result = result.filter(
        (p) =>
          p.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return result;
  }, [predictions, filterSignal, filterSector, searchTerm]);

  const summary = useMemo(() => ({
    buy: predictions.filter((p) => p.signal === 'BUY').length,
    sell: predictions.filter((p) => p.signal === 'SELL').length,
    hold: predictions.filter((p) => p.signal === 'HOLD').length,
  }), [predictions]);

  // Helper: signal label for layman
  const signalLabel = (signal: string) => {
    if (signal === 'BUY') return 'Good time to buy';
    if (signal === 'SELL') return 'Consider selling';
    return 'Wait and watch';
  };

  const signalBg = (signal: string) => {
    if (signal === 'BUY') return 'bg-emerald-500';
    if (signal === 'SELL') return 'bg-red-500';
    return 'bg-amber-500';
  };

  const returnColor = (ret: number) => {
    if (ret > 0) return 'text-emerald-600';
    if (ret < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  const trustBadge = (level: string) => {
    if (level === 'high') return { text: 'High accuracy', cls: 'text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-600/15' };
    if (level === 'low') return { text: 'Low accuracy', cls: 'text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/15' };
    return { text: 'Moderate accuracy', cls: 'text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/15' };
  };

  const sentimentLabel = (score: number) => {
    if (score >= 0.3) return { text: 'Positive news', cls: 'text-emerald-600' };
    if (score <= -0.3) return { text: 'Negative news', cls: 'text-red-600' };
    return { text: 'Neutral news', cls: 'text-slate-500' };
  };

  // Mini sparkline for 7-day price forecast
  const Sparkline = ({ data, current }: { data: number[]; current: number }) => {
    if (!data || data.length === 0) return null;
    const all = [current, ...data];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;
    const h = 32;
    const w = 84;
    const points = all.map((v, i) => {
      const x = (i / (all.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
    const goingUp = data[data.length - 1] > current;
    return (
      <svg width={w} height={h} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={goingUp ? '#10b981' : '#ef4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="0" cy={h - ((current - min) / range) * (h - 4) - 2} r="2.5" fill="#94a3b8" />
        <circle
          cx={w}
          cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
          r="2.5"
          fill={goingUp ? '#10b981' : '#ef4444'}
        />
      </svg>
    );
  };

  const lastUpdated = predictions.length > 0 ? predictions[0].updatedAt : null;

  /* ── Shared prediction card (used by All Stocks & My Stocks tabs) ── */
  const PredictionCard = ({ pred, idx, accent }: { pred: any; idx: number; accent: 'slate' | 'sky' }) => {
    const isExpanded = expandedSymbol === pred.symbol;
    const sent = sentimentLabel(pred.sentiment?.score || 0);
    const trust = trustBadge(pred.trustLevel || 'medium');

    return (
      <div
        className={`card overflow-hidden reveal transition-all duration-300 ${
          isExpanded
            ? 'ring-2 ring-sky-200 border-sky-300'
            : 'hover:shadow-card-hover hover:border-slate-300'
        } ${accent === 'sky' ? 'border-sky-100' : ''}`}
        style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}
      >
        {/* Main Row */}
        <div
          onClick={() => setExpandedSymbol(isExpanded ? null : pred.symbol)}
          className="px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left: signal + stock info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-sm ${signalBg(pred.signal)}`}>
                {pred.signal}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-slate-900">{pred.symbol}</p>
                  <span className="text-xs text-slate-400 hidden sm:inline truncate">{pred.companyName}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{pred.sector} &middot; {signalLabel(pred.signal)}</p>
              </div>
            </div>

            {/* Center: 7-day sparkline */}
            <div className="hidden md:block text-center">
              <Sparkline data={pred.priceForecast7d || []} current={pred.currentPrice} />
              <p className="text-[10px] text-slate-400 mt-0.5">Next 7 days</p>
            </div>

            {/* Right: prices + return */}
            <div className="text-right shrink-0">
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-[11px] text-slate-400">Now</p>
                  <p className="text-sm font-semibold text-slate-700">Rs. {pred.currentPrice?.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">7-day target</p>
                  <p className={`text-sm font-bold ${returnColor(pred.predictedReturn)}`}>
                    Rs. {pred.predictedPrice?.toFixed(2)}
                  </p>
                </div>
                <span className={`pill ${pred.predictedReturn > 0 ? 'pill-up' : pred.predictedReturn < 0 ? 'pill-down' : 'pill-flat'}`}>
                  {pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Expand chevron */}
            <svg className={`w-5 h-5 text-slate-300 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Holding info (portfolio tab) */}
          {pred.holding && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Shares: <strong className="text-slate-700">{pred.holding.quantity}</strong></span>
              <span>Avg cost: <strong className="text-slate-700">Rs. {pred.holding.averageCost?.toFixed(2)}</strong></span>
              <span>Invested: <strong className="text-slate-700">Rs. {pred.holding.invested?.toFixed(0)}</strong></span>
              <span>Current value: <strong className="text-slate-700">Rs. {pred.holding.currentValue?.toFixed(0)}</strong></span>
            </div>
          )}
        </div>

        {/* Expanded Detail */}
        {isExpanded && (
          <div className="border-t border-slate-100 px-5 py-6 space-y-6 bg-gradient-to-b from-slate-50/60 to-white animate-fade-in">
            {/* AI Prediction block — mirrors HoldingsPage */}
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/40 to-white p-5 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm"><Brain size={15} /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Prediction</h3>
                  <p className="text-[11px] text-slate-500">What our model expects over the next 7 days — not financial advice.</p>
                </div>
                {pred.dataAsOf && <span className="text-[11px] text-slate-400 ml-auto">as of {pred.dataAsOf}</span>}
              </div>

              {/* Metric tiles with layman helper lines */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="tile">
                  <p className="tile-label">Signal</p>
                  <span className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white ${signalBg(pred.signal)}`}>
                    {pred.signal === 'BUY' ? <TrendingUp size={12} /> : pred.signal === 'SELL' ? <TrendingDown size={12} /> : <Target size={12} />}
                    {pred.signal}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1.5">AI's call</p>
                </div>
                <div className="tile">
                  <p className="tile-label">Confidence</p>
                  <p className="tile-value">{pred.confidence?.toFixed(0)}%</p>
                  <p className="text-[10px] text-slate-400 mt-1">how sure</p>
                </div>
                <div className="tile">
                  <p className="tile-label">Target Price</p>
                  <p className={`tile-value ${returnColor(pred.predictedReturn)}`}>Rs. {pred.predictedPrice?.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">expected price</p>
                </div>
                <div className="tile">
                  <p className="tile-label">Est. Return</p>
                  <p className={`tile-value ${returnColor(pred.predictedReturn)}`}>{pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-400 mt-1">vs today</p>
                </div>
              </div>

              {/* AI reasoning */}
              <div className={`rounded-xl border px-4 py-4 ${pred.signal === 'BUY' ? 'bg-emerald-50/60 border-emerald-200' : pred.signal === 'SELL' ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Brain size={14} className={pred.signal === 'BUY' ? 'text-emerald-600' : pred.signal === 'SELL' ? 'text-red-600' : 'text-amber-600'} />
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${pred.signal === 'BUY' ? 'text-emerald-700' : pred.signal === 'SELL' ? 'text-red-700' : 'text-amber-700'}`}>What our AI says</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{cleanReasoning(pred.llmReasoning || pred.reasoning)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Price range */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                <SectionTitle icon={Target}>Where the price could go</SectionTitle>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Current price</span>
                    <span className="font-semibold text-slate-900">Rs. {pred.currentPrice?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Most likely price (7 days)</span>
                    <span className={`font-bold ${returnColor(pred.predictedReturn)}`}>
                      Rs. {pred.predictedPrice?.toFixed(2)}
                    </span>
                  </div>
                  {/* Price range bar — includes current price in bounds */}
                  {pred.priceRange?.low != null && pred.priceRange?.high != null && (() => {
                    const rangeLow = Math.min(pred.currentPrice, pred.priceRange.low);
                    const rangeHigh = Math.max(pred.currentPrice, pred.priceRange.high);
                    const totalRange = rangeHigh - rangeLow || 1;
                    const currentPct = ((pred.currentPrice - rangeLow) / totalRange) * 100;
                    const targetPct = ((pred.predictedPrice - rangeLow) / totalRange) * 100;
                    const lowPct = ((pred.priceRange.low - rangeLow) / totalRange) * 100;
                    const highPct = ((pred.priceRange.high - rangeLow) / totalRange) * 100;
                    const goingUp = pred.predictedPrice > pred.currentPrice;

                    return (
                      <div className="mt-3 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
                        <p className="text-[11px] text-slate-400 mb-3">Predicted price range in 7 days</p>
                        <div className="relative h-8">
                          {/* Full range line */}
                          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-200 rounded-full" />
                          {/* Model's predicted range (q10 to q90) */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-2.5 bg-sky-200 rounded-full"
                            style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
                          />
                          {/* Current price marker */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-500 rounded-full border-2 border-white shadow-md z-10"
                            style={{ left: `${Math.max(2, Math.min(98, currentPct))}%`, transform: 'translate(-50%, -50%)' }}
                            title={`Current: Rs. ${pred.currentPrice?.toFixed(2)}`}
                          />
                          {/* Target price marker */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md z-10 ${goingUp ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ left: `${Math.max(2, Math.min(98, targetPct))}%`, transform: 'translate(-50%, -50%)' }}
                            title={`Target: Rs. ${pred.predictedPrice?.toFixed(2)}`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-slate-400">Rs. {rangeLow.toFixed(0)}</span>
                          <span className="text-slate-400">Rs. {rangeHigh.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                            <span className="text-[10px] text-slate-400">Current</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${goingUp ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-[10px] text-slate-400">Target</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-4 h-1.5 rounded bg-sky-200" />
                            <span className="text-[10px] text-slate-400">Likely range</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Sentiment + Risk */}
              <div className="space-y-4">
                {/* News Sentiment */}
                <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Newspaper size={14} className="text-slate-400" /><span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Recent news mood</span></div>
                    {pred.sentiment?.source && pred.sentiment.source !== 'neutral' && (
                      <span className="text-[10px] text-slate-400">via {pred.sentiment.source}</span>
                    )}
                  </div>
                  <p className={`text-sm font-semibold mb-2 ${sent.cls}`}>{sent.text}</p>
                  {pred.sentiment?.key_headlines?.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {pred.sentiment.key_headlines.slice(0, 3).map((h: string, i: number) => (
                        <p key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-sky-200">{h}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No major headlines recently</p>
                  )}
                </div>

                {/* Risk Factors */}
                {pred.riskFactors?.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-red-500" /><span className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Things to watch out for</span></div>
                    <div className="flex flex-wrap gap-2">
                      {pred.riskFactors.map((risk: string, i: number) => (
                        <span key={i} className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-700 font-medium">{risk}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom tags */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${trust.cls}`}>
                <ShieldCheck size={12} /> {trust.text}
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {pred.forecastDays?.bullish || 0} of 7 days look positive
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                AI confidence: {pred.confidence?.toFixed(0)}%
              </span>
              {pred.trustNote && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                  {pred.trustNote}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <PageHeader
        icon={Brain}
        title="Stock Predictions"
        subtitle="Our AI analyzes 28 KSE-30 stocks daily and forecasts where prices may go in the next 7 days."
        accent="sky"
        action={
          lastUpdated ? (
            <div className="hidden sm:block text-right">
              <p className="eyebrow">Last updated</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {new Date(lastUpdated).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : undefined
        }
      />

      {/* Plain-language intro */}
      <div className="card p-4 mb-6 reveal stagger-1">
        <p className="text-sm text-slate-600 leading-relaxed">
          Each stock gets a{' '}
          <strong className="text-emerald-600">BUY</strong>,{' '}
          <strong className="text-amber-600">HOLD</strong>, or{' '}
          <strong className="text-red-600">SELL</strong> call based on price patterns, market data and news mood.
          A <strong>signal</strong> is the AI's call, <strong>confidence</strong> is how sure it is,
          and the <strong>target</strong> is the price it expects in 7 days.
        </p>
      </div>

      {/* Summary stat cards */}
      {!loading && predictions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Buy signals" tone="emerald" icon={TrendingUp} value={summary.buy} sub={<span className="text-slate-500">may go up</span>} />
          <StatCard label="Hold signals" tone="brand" icon={Target} value={summary.hold} sub={<span className="text-slate-500">wait & watch</span>} />
          <StatCard label="Sell signals" tone="red" icon={TrendingDown} value={summary.sell} sub={<span className="text-slate-500">may decline</span>} />
          <StatCard label="Analyzed" tone="sky" icon={BarChart3} value={predictions.length} sub={<span className="text-slate-500">stocks tracked</span>} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-6">
          {user && (
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'portfolio'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              My Stocks {portfolioPredictions.length > 0 && `(${portfolioPredictions.length})`}
            </button>
          )}
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'recommendations'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Top Picks
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            All Stocks ({predictions.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
            <p className="mt-4 text-slate-500">Loading predictions...</p>
          </div>
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load predictions"
          message={error}
          action={<button onClick={loadData} className="btn btn-sky"><ArrowRight size={16} /> Retry</button>}
        />
      ) : predictions.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No Predictions Yet"
          message="No predictions available yet. Check back later."
        />
      ) : activeTab === 'portfolio' ? (
        /* ============== MY STOCKS TAB ============== */
        <div>
          {portfolioPredictions.length === 0 ? (
            <EmptyState
              icon={PlusCircle}
              title="No stocks in your portfolio"
              message="Add KSE-30 stocks to your portfolio from the Dashboard to see personalized predictions here."
              action={<a href="/dashboard" className="btn btn-primary"><BarChart3 size={16} /> Go to Dashboard</a>}
            />
          ) : (
            <div>
              <SectionTitle
                icon={Sparkles}
                right={
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const pBuy = portfolioPredictions.filter((p: any) => p.signal === 'BUY').length;
                      const pSell = portfolioPredictions.filter((p: any) => p.signal === 'SELL').length;
                      const pHold = portfolioPredictions.filter((p: any) => p.signal === 'HOLD').length;
                      return (
                        <>
                          {pBuy > 0 && <span className="pill pill-up">{pBuy} to buy</span>}
                          {pHold > 0 && <span className="pill pill-brand">{pHold} to hold</span>}
                          {pSell > 0 && <span className="pill pill-down">{pSell} to sell</span>}
                        </>
                      );
                    })()}
                  </div>
                }
              >
                Predictions for Your Stocks
              </SectionTitle>
              <p className="text-sm text-slate-500 -mt-2 mb-5">
                Here's what our AI predicts for the {portfolioPredictions.length} stock{portfolioPredictions.length !== 1 ? 's' : ''} in your portfolio over the next 7 days.
              </p>

              <div className="space-y-3.5">
                {portfolioPredictions.map((pred: any, idx: number) => (
                  <PredictionCard key={pred.symbol} pred={pred} idx={idx} accent="sky" />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'recommendations' ? (
        /* ============== TOP PICKS TAB ============== */
        <div className="space-y-10">
          {recommendations?.topBuys?.length ? (
            <div>
              <SectionTitle
                icon={TrendingUp}
                right={<span className="text-xs text-slate-400">Our AI thinks these may go up</span>}
              >
                Stocks Worth Buying
              </SectionTitle>
              <div className="space-y-3.5">
                {recommendations.topBuys.map((rec, i) => (
                  <div key={rec.symbol} className="card card-interactive p-4 reveal" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{rec.symbol}</p>
                          <p className="text-xs text-slate-500">{rec.sector}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-600 font-bold text-lg">+{rec.predicted_return?.toFixed(1)}%</p>
                        <p className="text-xs text-slate-400">expected in 7 days</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Now:</span>
                        <span className="font-medium text-slate-700">Rs. {rec.current_price?.toFixed(2)}</span>
                      </div>
                      <ArrowRight size={16} className="text-emerald-400" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Target:</span>
                        <span className="font-semibold text-emerald-600">Rs. {rec.predicted_price?.toFixed(2)}</span>
                      </div>
                      <div className="ml-auto text-xs text-slate-400">
                        Confidence: {rec.confidence?.toFixed(0)}%
                      </div>
                    </div>
                    {rec.reasoning && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">{cleanReasoning(rec.reasoning)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {recommendations?.topSells?.length ? (
            <div>
              <SectionTitle
                icon={TrendingDown}
                right={<span className="text-xs text-slate-400">Our AI thinks these may decline</span>}
              >
                Stocks to Watch Out For
              </SectionTitle>
              <div className="space-y-3.5">
                {recommendations.topSells.map((rec, i) => (
                  <div key={rec.symbol} className="card card-interactive p-4 reveal" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{rec.symbol}</p>
                          <p className="text-xs text-slate-500">{rec.sector}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-600 font-bold text-lg">{rec.predicted_return?.toFixed(1)}%</p>
                        <p className="text-xs text-slate-400">expected in 7 days</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Now:</span>
                        <span className="font-medium text-slate-700">Rs. {rec.current_price?.toFixed(2)}</span>
                      </div>
                      <ArrowRight size={16} className="text-red-400" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Target:</span>
                        <span className="font-semibold text-red-600">Rs. {rec.predicted_price?.toFixed(2)}</span>
                      </div>
                      <div className="ml-auto text-xs text-slate-400">
                        Confidence: {rec.confidence?.toFixed(0)}%
                      </div>
                    </div>
                    {rec.reasoning && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">{cleanReasoning(rec.reasoning)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!recommendations?.topBuys?.length && !recommendations?.topSells?.length && (
            <EmptyState icon={Inbox} title="No recommendations yet" message="No recommendations available yet. Check back later." />
          )}
        </div>
      ) : (
        /* ============== ALL STOCKS TAB ============== */
        <div>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search stock name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filterSignal}
              onChange={(e) => setFilterSignal(e.target.value)}
              className="input"
            >
              <option value="">All Recommendations</option>
              <option value="BUY">Buy signals only</option>
              <option value="HOLD">Hold signals only</option>
              <option value="SELL">Sell signals only</option>
            </select>
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="input"
            >
              <option value="">All Sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Stock Cards */}
          <div className="space-y-3.5">
            {filtered.map((pred, idx) => (
              <PredictionCard key={pred.symbol} pred={pred} idx={idx} accent="slate" />
            ))}

            {filtered.length === 0 && (
              <EmptyState icon={Search} title="No matches" message="No stocks match your search." />
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      {predictions.length > 0 && (
        <div className="mt-8 p-4 rounded-xl bg-amber-50/60 border border-amber-200 reveal">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Important:</strong> These predictions are generated by an AI model for educational and informational purposes only.
            They are <strong>not financial advice</strong>. The stock market carries risk — you can lose money.
            Always do your own research or consult a financial advisor before making any investment decisions.
            Past predictions do not guarantee future results.
          </p>
        </div>
      )}
    </div>
  );
}
