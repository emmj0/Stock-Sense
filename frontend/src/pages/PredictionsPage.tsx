import { useEffect, useState, useMemo } from 'react';
import { fetchPredictions, fetchRecommendations, fetchPortfolioPredictions } from '../api';
import { useAuth } from '../providers/AuthProvider';

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
    return 'text-gray-600';
  };

  const trustBadge = (level: string) => {
    if (level === 'high') return { text: 'High accuracy', cls: 'text-emerald-700 bg-emerald-50' };
    if (level === 'low') return { text: 'Low accuracy', cls: 'text-red-700 bg-red-50' };
    return { text: 'Moderate accuracy', cls: 'text-amber-700 bg-amber-50' };
  };

  const sentimentLabel = (score: number) => {
    if (score >= 0.3) return { text: 'Positive news', cls: 'text-emerald-600' };
    if (score <= -0.3) return { text: 'Negative news', cls: 'text-red-600' };
    return { text: 'Neutral news', cls: 'text-gray-500' };
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
        <circle cx="0" cy={h - ((current - min) / range) * (h - 4) - 2} r="2.5" fill="#6b7280" />
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

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                Stock Predictions
              </h1>
              <p className="text-gray-500 text-base max-w-2xl">
                Our AI analyzes 28 KSE-30 stocks daily and predicts where prices may go in the next 7 days.
                Each stock gets a <strong className="text-emerald-600">BUY</strong>, <strong className="text-amber-600">HOLD</strong>, or <strong className="text-red-600">SELL</strong> recommendation based on price patterns, market data, and news sentiment.
              </p>
            </div>
            {lastUpdated && (
              <p className="text-xs text-gray-400 whitespace-nowrap">
                Last updated: {new Date(lastUpdated).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && predictions.length > 0 && (
        <div className="border-b border-gray-100 bg-gray-50/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">{summary.buy} stocks to buy</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-100">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm font-semibold text-amber-700">{summary.hold} to hold</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-100">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-700">{summary.sell} to sell</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100">
                <span className="text-sm text-gray-500">{predictions.length} stocks analyzed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-[72px] z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            {user && (
              <button
                onClick={() => setActiveTab('portfolio')}
                className={`py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'portfolio'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                My Stocks {portfolioPredictions.length > 0 && `(${portfolioPredictions.length})`}
              </button>
            )}
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recommendations'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Top Picks
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Stocks ({predictions.length})
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              <p className="mt-4 text-gray-500">Loading predictions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Retry
            </button>
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">No Predictions Yet</h3>
            <p className="text-gray-500">The prediction pipeline hasn't run yet. Check back later.</p>
          </div>
        ) : activeTab === 'portfolio' ? (
          /* ============== MY STOCKS TAB ============== */
          <div>
            {portfolioPredictions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">No stocks in your portfolio</h3>
                <p className="text-gray-500 mb-4">Add KSE-30 stocks to your portfolio from the Dashboard to see personalized predictions here.</p>
                <a href="/dashboard" className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors">
                  Go to Dashboard
                </a>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">Predictions for Your Stocks</h2>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                  Here's what our AI predicts for the {portfolioPredictions.length} stock{portfolioPredictions.length !== 1 ? 's' : ''} in your portfolio over the next 7 days.
                </p>

                {/* Portfolio summary */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {(() => {
                    const pBuy = portfolioPredictions.filter((p: any) => p.signal === 'BUY').length;
                    const pSell = portfolioPredictions.filter((p: any) => p.signal === 'SELL').length;
                    const pHold = portfolioPredictions.filter((p: any) => p.signal === 'HOLD').length;
                    return (
                      <>
                        {pBuy > 0 && (
                          <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-700">
                            {pBuy} to buy
                          </span>
                        )}
                        {pHold > 0 && (
                          <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-sm font-medium text-amber-700">
                            {pHold} to hold
                          </span>
                        )}
                        {pSell > 0 && (
                          <span className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-sm font-medium text-red-700">
                            {pSell} to sell
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Render portfolio predictions using same card layout as All Stocks */}
                <div className="grid gap-3">
                  {portfolioPredictions.map((pred: any) => {
                    const isExpanded = expandedSymbol === pred.symbol;
                    const trust = trustBadge(pred.trustLevel || 'medium');

                    return (
                      <div key={pred.symbol} className="border border-blue-100 rounded-xl overflow-hidden hover:border-blue-200 transition-colors bg-blue-50/20">
                        <div
                          onClick={() => setExpandedSymbol(isExpanded ? null : pred.symbol)}
                          className="p-4 cursor-pointer hover:bg-blue-50/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${signalBg(pred.signal)}`}>
                                {pred.signal}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900">{pred.symbol}</p>
                                  <span className="text-xs text-gray-400 hidden sm:inline">{pred.companyName}</span>
                                </div>
                                <p className="text-xs text-gray-400">{pred.sector} &middot; {signalLabel(pred.signal)}</p>
                              </div>
                            </div>
                            <div className="hidden md:block">
                              <Sparkline data={pred.priceForecast7d || []} current={pred.currentPrice} />
                              <p className="text-[10px] text-gray-400 text-center mt-0.5">7-day trend</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-3">
                                <div className="hidden sm:block text-right">
                                  <p className="text-xs text-gray-400">Now</p>
                                  <p className="text-sm font-medium text-gray-700">Rs. {pred.currentPrice?.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">7-day target</p>
                                  <p className={`text-sm font-bold ${returnColor(pred.predictedReturn)}`}>
                                    Rs. {pred.predictedPrice?.toFixed(2)}
                                  </p>
                                </div>
                                <div className={`text-right px-2.5 py-1 rounded-lg ${pred.predictedReturn > 0 ? 'bg-emerald-50' : pred.predictedReturn < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                  <p className={`text-base font-bold ${returnColor(pred.predictedReturn)}`}>
                                    {pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                            <svg className={`w-5 h-5 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {/* Holding info */}
                          {pred.holding && (
                            <div className="mt-2 pt-2 border-t border-blue-100 flex flex-wrap gap-4 text-xs text-gray-500">
                              <span>Shares: <strong className="text-gray-700">{pred.holding.quantity}</strong></span>
                              <span>Avg cost: <strong className="text-gray-700">Rs. {pred.holding.averageCost?.toFixed(2)}</strong></span>
                              <span>Invested: <strong className="text-gray-700">Rs. {pred.holding.invested?.toFixed(0)}</strong></span>
                              <span>Current value: <strong className="text-gray-700">Rs. {pred.holding.currentValue?.toFixed(0)}</strong></span>
                            </div>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="border-t border-blue-100 bg-white p-4 sm:p-6 space-y-5">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                What our AI says
                              </h4>
                              <p className="text-sm text-gray-600 leading-relaxed">{pred.llmReasoning || pred.reasoning}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${trust.cls}`}>{trust.text}</span>
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                                {pred.forecastDays?.bullish || 0} of 7 days look positive
                              </span>
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                                Model confidence: {pred.confidence?.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'recommendations' ? (
          /* ============== TOP PICKS TAB ============== */
          <div className="space-y-10">
            {recommendations?.topBuys?.length ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h2 className="text-lg font-bold text-gray-900">Stocks Worth Buying</h2>
                  <span className="text-xs text-gray-400 ml-1">Our AI thinks these may go up</span>
                </div>
                <div className="grid gap-3">
                  {recommendations.topBuys.map((rec, i) => (
                    <div key={rec.symbol} className="p-4 border border-gray-200 rounded-xl hover:border-emerald-200 hover:bg-emerald-50/20 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                            #{i + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{rec.symbol}</p>
                            <p className="text-xs text-gray-500">{rec.sector}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-600 font-bold text-lg">+{rec.predicted_return?.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400">expected in 7 days</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Now:</span>
                          <span className="font-medium">Rs. {rec.current_price?.toFixed(2)}</span>
                        </div>
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Target:</span>
                          <span className="font-semibold text-emerald-600">Rs. {rec.predicted_price?.toFixed(2)}</span>
                        </div>
                        <div className="ml-auto text-xs text-gray-400">
                          Model confidence: {rec.confidence?.toFixed(0)}%
                        </div>
                      </div>
                      {rec.reasoning && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-2">{rec.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {recommendations?.topSells?.length ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <h2 className="text-lg font-bold text-gray-900">Stocks to Watch Out For</h2>
                  <span className="text-xs text-gray-400 ml-1">Our AI thinks these may decline</span>
                </div>
                <div className="grid gap-3">
                  {recommendations.topSells.map((rec, i) => (
                    <div key={rec.symbol} className="p-4 border border-gray-200 rounded-xl hover:border-red-200 hover:bg-red-50/20 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                            #{i + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{rec.symbol}</p>
                            <p className="text-xs text-gray-500">{rec.sector}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-red-600 font-bold text-lg">{rec.predicted_return?.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400">expected in 7 days</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Now:</span>
                          <span className="font-medium">Rs. {rec.current_price?.toFixed(2)}</span>
                        </div>
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Target:</span>
                          <span className="font-semibold text-red-600">Rs. {rec.predicted_price?.toFixed(2)}</span>
                        </div>
                        <div className="ml-auto text-xs text-gray-400">
                          Model confidence: {rec.confidence?.toFixed(0)}%
                        </div>
                      </div>
                      {rec.reasoning && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-2">{rec.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!recommendations?.topBuys?.length && !recommendations?.topSells?.length && (
              <div className="text-center py-16 text-gray-500">No recommendations available yet.</div>
            )}
          </div>
        ) : (
          /* ============== ALL STOCKS TAB ============== */
          <div>
            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Search stock name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <select
                value={filterSignal}
                onChange={(e) => setFilterSignal(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">All Recommendations</option>
                <option value="BUY">Buy signals only</option>
                <option value="HOLD">Hold signals only</option>
                <option value="SELL">Sell signals only</option>
              </select>
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">All Sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Stock Cards */}
            <div className="grid gap-3">
              {filtered.map((pred) => {
                const isExpanded = expandedSymbol === pred.symbol;
                const sent = sentimentLabel(pred.sentiment?.score || 0);
                const trust = trustBadge(pred.trustLevel || 'medium');

                return (
                  <div key={pred.symbol} className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                    {/* Main Row */}
                    <div
                      onClick={() => setExpandedSymbol(isExpanded ? null : pred.symbol)}
                      className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Stock info + signal */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${signalBg(pred.signal)}`}>
                            {pred.signal}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{pred.symbol}</p>
                              <span className="text-xs text-gray-400 hidden sm:inline">{pred.companyName}</span>
                            </div>
                            <p className="text-xs text-gray-400">{pred.sector} &middot; {signalLabel(pred.signal)}</p>
                          </div>
                        </div>

                        {/* Center: Price trend sparkline */}
                        <div className="hidden md:block">
                          <Sparkline data={pred.priceForecast7d || []} current={pred.currentPrice} />
                          <p className="text-[10px] text-gray-400 text-center mt-0.5">7-day trend</p>
                        </div>

                        {/* Right: Prices + return */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-right">
                              <p className="text-xs text-gray-400">Now</p>
                              <p className="text-sm font-medium text-gray-700">Rs. {pred.currentPrice?.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">7-day target</p>
                              <p className={`text-sm font-bold ${returnColor(pred.predictedReturn)}`}>
                                Rs. {pred.predictedPrice?.toFixed(2)}
                              </p>
                            </div>
                            <div className={`text-right px-2.5 py-1 rounded-lg ${pred.predictedReturn > 0 ? 'bg-emerald-50' : pred.predictedReturn < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                              <p className={`text-base font-bold ${returnColor(pred.predictedReturn)}`}>
                                {pred.predictedReturn > 0 ? '+' : ''}{pred.predictedReturn?.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expand icon */}
                        <svg className={`w-5 h-5 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-6 space-y-5">
                        {/* AI Analysis */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            What our AI says
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {pred.llmReasoning || pred.reasoning}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Price Forecast */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">Where the price could go</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Current price</span>
                                <span className="font-semibold">Rs. {pred.currentPrice?.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Most likely price (7 days)</span>
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
                                  <div className="mt-3 p-3 rounded-lg bg-white border border-gray-100">
                                    <p className="text-xs text-gray-400 mb-3">Predicted price range in 7 days</p>
                                    <div className="relative h-8">
                                      {/* Full range line */}
                                      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-100 rounded-full" />
                                      {/* Model's predicted range (q10 to q90) */}
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 h-2.5 bg-blue-100 rounded-full"
                                        style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
                                      />
                                      {/* Current price marker */}
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-500 rounded-full border-2 border-white shadow-md z-10"
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
                                      <span className="text-gray-400">Rs. {rangeLow.toFixed(0)}</span>
                                      <span className="text-gray-400">Rs. {rangeHigh.toFixed(0)}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-4 mt-2">
                                      <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-gray-500" />
                                        <span className="text-[10px] text-gray-400">Current</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${goingUp ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className="text-[10px] text-gray-400">Target</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="w-4 h-1.5 rounded bg-blue-100" />
                                        <span className="text-[10px] text-gray-400">Predicted range</span>
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
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-2">Recent news mood</h4>
                              <div className="p-3 rounded-lg bg-white border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-sm font-medium ${sent.cls}`}>{sent.text}</span>
                                  {pred.sentiment?.source && pred.sentiment.source !== 'neutral' && (
                                    <span className="text-[10px] text-gray-400">via {pred.sentiment.source}</span>
                                  )}
                                </div>
                                {pred.sentiment?.key_headlines?.length > 0 ? (
                                  <ul className="space-y-1">
                                    {pred.sentiment.key_headlines.slice(0, 3).map((h, i) => (
                                      <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                                        <span className="text-gray-300 mt-0.5">-</span>
                                        <span>{h}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-gray-400">No major headlines recently</p>
                                )}
                              </div>
                            </div>

                            {/* Risk Factors */}
                            {pred.riskFactors?.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-800 mb-2">Things to watch out for</h4>
                                <ul className="space-y-1">
                                  {pred.riskFactors.map((risk, i) => (
                                    <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                                      <span className="text-amber-400 mt-0.5">!</span>
                                      <span>{risk}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom tags */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${trust.cls}`}>
                            {trust.text}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                            {pred.forecastDays?.bullish || 0} of 7 days look positive
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                            Model confidence: {pred.confidence?.toFixed(0)}%
                          </span>
                          {pred.trustNote && (
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-500">
                              {pred.trustNote}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No stocks match your search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        {predictions.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Important:</strong> These predictions are generated by an AI model for educational and informational purposes only.
              They are <strong>not financial advice</strong>. The stock market carries risk — you can lose money.
              Always do your own research or consult a financial advisor before making any investment decisions.
              Past predictions do not guarantee future results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
