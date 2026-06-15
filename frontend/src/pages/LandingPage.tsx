import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { fetchIndexes, fetchSectors } from '../api';
import { useAuthModal } from '../components/AuthModal';
import { ShieldCheck, Lock, BarChart3, Bell, Plus, PieChart, MessageSquare, Zap, GraduationCap } from 'lucide-react';

const processSteps = [
  { title: 'Add your desired stocks', description: 'Curate your portfolio with stocks that match your strategy', icon: Plus },
  { title: 'Watch predictions', description: 'See AI-driven price forecasts and sentiment-based signals', icon: PieChart },
  { title: 'Take help with your assistant', description: 'Chat with your always-on advisor for guidance', icon: MessageSquare },
  { title: 'Receive alerts', description: 'Stay informed with real-time notifications on moves', icon: Zap },
  { title: 'Learn about stocks', description: 'Build literacy through interactive courses and quizzes', icon: GraduationCap },
];

const featureBullets = [
  { title: 'Live PSX data', text: 'Real-time stock prices, indexes, sectors, and market data from the Pakistan Stock Exchange — updated daily.' },
  { title: 'AI-powered predictions', text: '7-day price forecasts with buy, hold, and sell signals powered by deep learning and news analysis.' },
  { title: 'Smart AI assistant', text: 'Ask anything about stocks, your portfolio, or investing — get instant, personalized answers.' },
  { title: 'Learn as you invest', text: 'Interactive courses, quizzes, and progress tracking to build your stock market knowledge step by step.' },
];

const srsSummary = [
  { heading: 'The Problem', text: 'New investors in Pakistan struggle with fragmented data, confusing tools, and lack of reliable guidance for PSX investing.' },
  { heading: 'Our Solution', text: 'StockSense brings together live market data, AI price predictions, a smart assistant, and educational courses — all in one place.' },
  { heading: 'What You Get', text: 'A complete investing companion: personalized stock recommendations, portfolio tracking, an AI chatbot, and learning modules.' },
  { heading: 'Built For You', text: 'Designed for everyday Pakistani investors — whether you are a complete beginner or an experienced trader looking for AI insights.' },
];

// Floating decorative elements for hero
const FloatingElement = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <div
    className={`absolute opacity-60 ${className}`}
    style={{
      animation: `float 6s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  />
);

// Reveal-on-scroll hook (IntersectionObserver)
function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); ob.disconnect(); } },
      { threshold }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// A single milestone on the animated roadmap (zig-zag on desktop, stacked on mobile)
function RoadmapStep({
  step, index,
}: {
  step: { title: string; description: string; icon: any };
  index: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const Icon = step.icon;
  const left = index % 2 === 0; // alternate sides on desktop
  return (
    <div ref={ref} className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
      {/* Card */}
      <div
        className={`pl-16 md:pl-0 ${left ? 'md:pr-14 md:text-right' : 'md:col-start-2 md:pl-14'}`}
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: `${index * 0.08}s`,
        }}
      >
        <div className="card-interactive p-6 group hover:border-brand-300">
          <div className={`flex items-center gap-3 mb-2 ${left ? 'md:flex-row-reverse' : ''}`}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-50 to-sky-50 flex items-center justify-center group-hover:from-brand-500 group-hover:to-brand-600 transition-all duration-300 shrink-0">
              <Icon className="w-5 h-5 text-brand-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <span className="eyebrow">Step {index + 1}</span>
          </div>
          <h3 className="font-display text-xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{step.title}</h3>
          <p className="text-slate-500 leading-relaxed mt-1.5">{step.description}</p>
        </div>
      </div>

      {/* Node on the central line */}
      <div className="absolute left-4 md:left-1/2 top-6 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10">
        <div
          className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-brand-500/40 ring-4 ring-white"
          style={{
            transform: inView ? 'scale(1)' : 'scale(0)',
            transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            transitionDelay: `${index * 0.08 + 0.1}s`,
          }}
        >
          {index + 1}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { openAuth } = useAuthModal();
  const [indexes, setIndexes] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [indexSlide, setIndexSlide] = useState(0);
  const [sectorSlide, setSectorSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Auto-slide for indexes
  useEffect(() => {
    if (indexes.length > 1) {
      const interval = setInterval(() => {
        setIndexSlide((prev) => (prev + 1) % indexes.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [indexes.length]);

  // Auto-slide for sectors
  useEffect(() => {
    if (sectors.length > 1) {
      const interval = setInterval(() => {
        setSectorSlide((prev) => (prev + 1) % sectors.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [sectors.length]);

  // Trigger animations on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const loadIndexes = async () => {
      setIndexLoading(true);
      try {
        const data = await fetchIndexes();
        setIndexes(data);
      } catch (err) {
        console.error('Failed to load indexes:', err);
      } finally {
        setIndexLoading(false);
      }
    };
    loadIndexes();
  }, []);

  useEffect(() => {
    const loadSectors = async () => {
      setSectorLoading(true);
      try {
        const data = await fetchSectors();
        setSectors(data);
      } catch (err) {
        console.error('Failed to load sectors:', err);
      } finally {
        setSectorLoading(false);
      }
    };
    loadSectors();
  }, []);

  const currentIndex = indexes[indexSlide];
  const currentSector = sectors[sectorSlide];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .animate-fadeInUp { animation: fadeInUp 0.8s ease-out forwards; }
        .animate-fadeInLeft { animation: fadeInLeft 0.8s ease-out forwards; }
        .animate-fadeInRight { animation: fadeInRight 0.8s ease-out forwards; }
        .animate-slideIn { animation: slideIn 0.5s ease-out forwards; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>

      {/* Hero Section - Launch Style */}
      <section ref={heroRef} className="relative min-h-[92vh] -mt-[72px] pt-[72px] flex items-center px-5 sm:px-8 lg:px-12 overflow-hidden">
        {/* Dotted Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
        </div>
        {/* Soft brand glow */}
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-brand-200/40 rounded-full blur-3xl" />
        <div className="absolute top-32 right-0 w-[24rem] h-[24rem] bg-sky-200/40 rounded-full blur-3xl" />

        <div className="mx-auto max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Content */}
          <div className={`space-y-8 ${isVisible ? 'animate-fadeInLeft' : 'opacity-0'}`}>
            <div className="space-y-6">
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight">
                Smart Investing
                <br />
                <span className="bg-gradient-to-r from-brand-500 to-sky-500 bg-clip-text text-transparent">Made Simple</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-500 max-w-lg leading-relaxed">
                Track PSX indexes, sectors, and market data with AI-driven predictions. Your intelligent financial companion for smarter investment decisions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3.5">
              <button
                onClick={() => openAuth('signup')}
                className="btn btn-primary px-7 py-3.5 text-base group"
              >
                Get Started
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <Link
                to="/market-watch"
                className="btn btn-secondary px-7 py-3.5 text-base"
              >
                Explore Market
              </Link>
            </div>
          </div>

          {/* Right Illustration Area */}
          <div className={`relative hidden lg:block ${isVisible ? 'animate-fadeInRight delay-200' : 'opacity-0'}`}>
            {/* Main Illustration Container */}
            <div className="relative w-full h-[500px]">
              {/* Floating Elements */}
              <FloatingElement className="top-10 left-10 w-16 h-16 bg-brand-100 rounded-2xl" delay={0} />
              <FloatingElement className="top-32 right-20 w-12 h-12 bg-sky-100 rounded-full" delay={1} />
              <FloatingElement className="bottom-20 left-20 w-14 h-14 bg-brand-200/70 rounded-xl" delay={2} />
              <FloatingElement className="top-20 right-10 w-10 h-10 bg-sky-200/70 rounded-full" delay={0.5} />
              <FloatingElement className="bottom-40 right-32 w-8 h-8 bg-brand-300/60 rounded-lg" delay={1.5} />

              {/* Central Card - Stock Preview */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-white rounded-2xl shadow-card-hover p-6 border border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">KSE-100</p>
                      <p className="text-xs text-slate-500">Pakistan Stock</p>
                    </div>
                  </div>
                  <span className="pill pill-up">+2.4%</span>
                </div>
                <div className="h-24 bg-gradient-to-r from-brand-50 to-sky-50 rounded-xl flex items-end justify-center pb-4">
                  <svg className="w-full h-16 text-brand-500" viewBox="0 0 200 50" fill="none">
                    <path d="M0 40 Q20 30, 40 35 T80 25 T120 30 T160 15 T200 20" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M0 40 Q20 30, 40 35 T80 25 T120 30 T160 15 T200 20 V50 H0 Z" fill="url(#gradient)" opacity="0.2" />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Small Stats Cards */}
              <div className="absolute top-16 right-8 bg-white rounded-xl shadow-card p-4 border border-slate-200/80" style={{ animation: 'float 5s ease-in-out infinite', animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Today</p>
                    <p className="text-sm font-bold text-emerald-600">+1,234</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-24 left-8 bg-white rounded-xl shadow-card p-4 border border-slate-200/80" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Volume</p>
                    <p className="text-sm font-bold text-slate-900">2.4M</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Indexes Slideshow */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 border-b border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="eyebrow mb-2">Live market</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 text-slate-900">
              Track Live Indexes
            </h2>
            <p className="text-slate-500 text-lg">
              Real-time data from PSX, updated every few minutes.
            </p>
          </div>

          {indexLoading ? (
            <div className="flex items-center justify-center h-64 card shadow-card">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500">Loading indexes...</p>
              </div>
            </div>
          ) : indexes.length > 0 && currentIndex ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden">
                <div
                  className="card p-4 sm:p-6 lg:p-8 hover:shadow-card-hover transition-all duration-500 ease-out"
                  key={indexSlide}
                  style={{ animation: 'slideIn 0.5s ease-out' }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6">
                    <div>
                      <p className="eyebrow">Index</p>
                      <p className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mt-1">{currentIndex.index || 'N/A'}</p>
                    </div>
                    <div className="text-right mt-3 sm:mt-0">
                      <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${parseFloat(currentIndex.change) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {parseFloat(currentIndex.change) >= 0 ? '+' : ''}{currentIndex.change}
                      </p>
                      <p className={`text-base sm:text-lg font-medium ${parseFloat(currentIndex.percent_change) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {currentIndex.percent_change}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-brand-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Current</p>
                      <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">{currentIndex.current}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-brand-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">High</p>
                      <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">{currentIndex.high}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-brand-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Low</p>
                      <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">{currentIndex.low}</p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-400 mt-6">
                    Last updated: {currentIndex.scraped_at ? new Date(typeof currentIndex.scraped_at === 'string' ? currentIndex.scraped_at : currentIndex.scraped_at.$date).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Progress Dots */}
              <div className="flex items-center justify-center gap-2">
                {indexes.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setIndexSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === indexSlide ? 'bg-brand-500 w-8' : 'bg-slate-300 w-2 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No indexes available</div>
          )}
        </div>
      </section>

      {/* Sectors Slideshow */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="eyebrow mb-2">Market breadth</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 text-slate-900">
              Explore Sectors
            </h2>
            <p className="text-slate-500 text-lg">
              Spot advances, declines, and market momentum by sector.
            </p>
          </div>

          {sectorLoading ? (
            <div className="flex items-center justify-center h-64 card shadow-card">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500">Loading sectors...</p>
              </div>
            </div>
          ) : sectors.length > 0 && currentSector ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden">
                <div
                  className="card p-4 sm:p-6 lg:p-8 hover:shadow-card-hover transition-all duration-500 ease-out"
                  key={sectorSlide}
                  style={{ animation: 'slideIn 0.5s ease-out' }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6">
                    <div>
                      <p className="eyebrow">Sector</p>
                      <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{currentSector.name}</p>
                    </div>
                    <div className="pill pill-sky mt-3 sm:mt-0 px-3 sm:px-4 py-2 text-xs sm:text-sm">
                      {currentSector.turnover}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-emerald-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Advance</p>
                      <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1">{currentSector.advance}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-red-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Decline</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{currentSector.decline}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-slate-400 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Unchanged</p>
                      <p className="text-lg sm:text-2xl font-bold text-slate-700 mt-1">{currentSector.unchange || 0}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4 hover:shadow-card hover:border-brand-300 transition-all duration-300">
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Market Cap</p>
                      <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">{currentSector.market_cap} B</p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-400 mt-6">
                    Last updated: {currentSector.scraped_at ? new Date(typeof currentSector.scraped_at === 'string' ? currentSector.scraped_at : currentSector.scraped_at.$date).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Progress Dots */}
              <div className="flex items-center justify-center gap-2">
                {sectors.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSectorSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === sectorSlide ? 'bg-brand-500 w-8' : 'bg-slate-300 w-2 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No sectors available</div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-3">Capabilities</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-slate-900">
              What StockSense Delivers
            </h2>
            <p className="text-slate-500 text-lg">
              Condensed from the system requirements specification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {featureBullets.map((item, idx) => (
              <div
                key={item.title}
                className="group card-interactive p-8 hover:border-brand-300"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500 transition-colors duration-300">
                    <svg className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{item.title}</h3>
                    <p className="text-slate-500 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Timeline Section */}
      <section id="how-it-works" className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="pill pill-brand mb-4">
              How It Works
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-slate-900">
              Your StockSense Flow
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              A smooth journey through intelligent investing in just five simple steps.
            </p>
          </div>

          {/* Animated Roadmap */}
          <div className="relative max-w-4xl mx-auto">
            {/* central connecting line */}
            <div className="absolute left-[18px] md:left-1/2 md:-translate-x-1/2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-200 via-sky-200 to-brand-200 rounded-full" />
            <div className="space-y-10 md:space-y-14">
              {processSteps.map((step, idx) => (
                <RoadmapStep key={idx} step={step} index={idx} />
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <button
              onClick={() => openAuth('signup')}
              className="btn btn-primary px-7 py-3.5 text-base"
            >
              Start Your Journey
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* SRS Summary Section */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-3">Our mission</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-slate-900">
              Why StockSense
            </h2>
            <p className="text-slate-500 text-lg">
              Understanding the core of our mission and commitment.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {srsSummary.map((item, idx) => (
              <div
                key={item.heading}
                className="group card-interactive p-6 bg-gradient-to-br from-slate-50 to-white hover:border-brand-300"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/25 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white font-bold">{idx + 1}</span>
                </div>
                <h3 className="text-sm font-bold text-brand-600 uppercase tracking-[0.08em] mb-3">
                  {item.heading}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Safety Section */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 bg-gradient-to-br from-slate-50 to-brand-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 mb-6 shadow-xl shadow-brand-500/30">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-slate-900">
              Our Stance on Privacy & Safety
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Your security and trust are our top priorities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: 'Simulation First',
                text: 'We run a simulation-first experience, avoiding live transactions and protecting your investment choices in a sandbox environment.',
                gradient: 'from-brand-500 to-amber-500'
              },
              {
                icon: Lock,
                title: 'End-to-End Encryption',
                text: 'Your credentials are encrypted end-to-end. We never store plaintext passwords or payment details.',
                gradient: 'from-sky-500 to-blue-600'
              },
              {
                icon: BarChart3,
                title: 'Transparent Data',
                text: 'All scraped market data comes from public sources and is treated transparently. Data refreshes every few minutes.',
                gradient: 'from-violet-500 to-fuchsia-500'
              },
              {
                icon: Bell,
                title: 'You\'re in Control',
                text: 'Alerts respect your notification preferences. You control what you see and when you see it.',
                gradient: 'from-emerald-500 to-teal-500'
              },
            ].map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={idx}
                  className="group card-interactive p-8 hover:border-brand-300"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500 group-hover:ring-brand-500 transition-all duration-300">
                      <IconComponent className="w-7 h-7 text-brand-600 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-slate-500 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 sm:py-28 px-5 sm:px-8 lg:px-12 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="eyebrow mb-3">Contact</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-slate-900">
              Get in Touch
            </h2>
            <p className="text-slate-500 text-lg">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <form className="space-y-6 card p-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                placeholder="What's this about?"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Message
              </label>
              <textarea
                rows={6}
                placeholder="Tell us more..."
                className="input resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-3.5"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-ink-950 text-white overflow-hidden">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/4 w-96 h-96 bg-brand-500/10 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 w-96 h-96 bg-sky-500/10 blur-3xl rounded-full" />

        {/* CTA band */}
        <div className="relative px-5 sm:px-8 lg:px-12 pt-16 sm:pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-orange-600 p-8 sm:p-12 text-center shadow-2xl shadow-brand-500/20">
              <h3 className="font-display text-2xl sm:text-4xl font-bold text-white">Ready to invest smarter?</h3>
              <p className="text-white/80 mt-3 max-w-xl mx-auto">Join StockSense and turn live PSX data into confident decisions — with AI on your side.</p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                <button onClick={() => openAuth('signup')} className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-brand-600 font-semibold rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98]">
                  Get Started Free
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
                <Link to="/market-watch" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl hover:bg-white/25 transition-all backdrop-blur">
                  Explore Market
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer body */}
        <div className="relative px-5 sm:px-8 lg:px-12 py-14">
          <div className="max-w-6xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 lg:gap-12 mb-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="StockSense Logo" className="w-9 h-9 object-contain" />
                  <span className="font-display text-xl font-bold">StockSense<span className="text-brand-500">.</span></span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                  Intelligent investing for the Pakistan Stock Exchange — live data, AI predictions, and learning in one place.
                </p>
              </div>

              {[
                { h: 'Product', links: [['Dashboard', '/dashboard', true], ['Market Watch', '/market-watch', true], ['Portfolio', '#', false], ['Alerts', '#', false]] },
                { h: 'Resources', links: [['Documentation', '#', false], ['Blog', '#', false], ['Learning Center', '#', false], ['FAQ', '#', false]] },
                { h: 'Company', links: [['About', '#', false], ['Privacy', '#', false], ['Terms', '#', false], ['Contact', '#contact', false]] },
              ].map(col => (
                <div key={col.h} className="space-y-4">
                  <h4 className="font-semibold text-xs uppercase tracking-[0.12em] text-slate-300">{col.h}</h4>
                  <ul className="space-y-2.5 text-sm text-slate-400">
                    {col.links.map(([label, href, isRoute]) => (
                      <li key={label as string}>
                        {isRoute
                          ? <Link to={href as string} className="hover:text-brand-400 transition-colors">{label}</Link>
                          : <a href={href as string} className="hover:text-brand-400 transition-colors">{label}</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-7 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400">
              <p>&copy; 2025 StockSense. All rights reserved.</p>
              <div className="flex gap-2.5">
                {[
                  'M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84',
                  'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z',
                  'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
                ].map((d, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-brand-500 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
