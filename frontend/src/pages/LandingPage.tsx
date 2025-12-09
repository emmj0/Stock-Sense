import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { fetchIndexes, fetchSectors } from '../api';
import { HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineChartBar, HiOutlineBell, HiOutlinePlus, HiOutlineChartPie, HiOutlineChatAlt2, HiOutlineLightningBolt, HiOutlineAcademicCap } from 'react-icons/hi';

const processSteps = [
  { title: 'Add your desired stocks', description: 'Curate your portfolio with stocks that match your strategy', icon: HiOutlinePlus },
  { title: 'Watch predictions', description: 'See AI-driven price forecasts and sentiment-based signals', icon: HiOutlineChartPie },
  { title: 'Take help with your assistant', description: 'Chat with your always-on advisor for guidance', icon: HiOutlineChatAlt2 },
  { title: 'Receive alerts', description: 'Stay informed with real-time notifications on moves', icon: HiOutlineLightningBolt },
  { title: 'Learn about stocks', description: 'Build literacy through interactive courses and quizzes', icon: HiOutlineAcademicCap },
];

const featureBullets = [
  { title: 'Real PSX coverage', text: 'Indexes, sectors, and market watch backed by scraped PSX data refreshed every few minutes.' },
  { title: 'Predictive intelligence', text: 'Price trends, sentiment, and confidence levels guiding buy / hold / sell signals.' },
  { title: 'Always-on assistant', text: 'Conversational advisor to explain moves, surface insights, and keep you on track.' },
  { title: 'Learning-first design', text: 'Micro-courses, quizzes, and progress tracking to build literacy alongside returns.' },
];

const srsSummary = [
  { heading: 'Problem', text: 'Retail investors lack a single, trustworthy PSX companion. Data is fragmented, tools are manual, and scams erode confidence.' },
  { heading: 'Solution', text: 'StockSense unifies scraped market data, predictive analytics, sentiment, alerts, and education in a safe simulation-first workspace.' },
  { heading: 'Objectives', text: 'Cross-platform app, ML recommendations, AI chatbot, education module, secure auth, and transparent data handling.' },
  { heading: 'Constraints', text: 'Dependent on scraper uptime, public data structures, network stability, and model accuracy; operates in a simulation environment.' },
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

export default function LandingPage() {
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
    <div className="min-h-screen bg-white text-black overflow-x-hidden">
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
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Dotted Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
        </div>

        <div className="mx-auto max-w-7xl w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Content */}
          <div className={`space-y-8 ${isVisible ? 'animate-fadeInLeft' : 'opacity-0'}`}>
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                Smart Investing
                <br />
                <span className="text-blue-600">Made Simple</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-500 max-w-lg leading-relaxed">
                Track PSX indexes, sectors, and market data with AI-driven predictions. Your intelligent financial companion for smarter investment decisions.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/signup"
                className="group px-8 py-4 text-base font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                Get Started
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/market-watch"
                className="px-8 py-4 text-base font-semibold text-gray-700 border-2 border-gray-200 rounded-full hover:border-gray-300 hover:bg-gray-50 transition-all duration-300"
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
              <FloatingElement className="top-10 left-10 w-16 h-16 bg-blue-100 rounded-2xl" delay={0} />
              <FloatingElement className="top-32 right-20 w-12 h-12 bg-indigo-100 rounded-full" delay={1} />
              <FloatingElement className="bottom-20 left-20 w-14 h-14 bg-cyan-100 rounded-xl" delay={2} />
              <FloatingElement className="top-20 right-10 w-10 h-10 bg-purple-100 rounded-full" delay={0.5} />
              <FloatingElement className="bottom-40 right-32 w-8 h-8 bg-blue-200 rounded-lg" delay={1.5} />
              
              {/* Central Card - Stock Preview */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-white rounded-2xl shadow-2xl p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">KSE-100</p>
                      <p className="text-xs text-gray-500">Pakistan Stock</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">+2.4%</span>
                </div>
                <div className="h-24 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl flex items-end justify-center pb-4">
                  <svg className="w-full h-16 text-blue-600" viewBox="0 0 200 50" fill="none">
                    <path d="M0 40 Q20 30, 40 35 T80 25 T120 30 T160 15 T200 20" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M0 40 Q20 30, 40 35 T80 25 T120 30 T160 15 T200 20 V50 H0 Z" fill="url(#gradient)" opacity="0.2" />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Small Stats Cards */}
              <div className="absolute top-16 right-8 bg-white rounded-xl shadow-xl p-4 border-2 border-gray-200" style={{ animation: 'float 5s ease-in-out infinite', animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Today</p>
                    <p className="text-sm font-bold text-green-600">+1,234</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-24 left-8 bg-white rounded-xl shadow-xl p-4 border-2 border-gray-200" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Volume</p>
                    <p className="text-sm font-bold text-gray-900">2.4M</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Indexes Slideshow */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
              Track Live Indexes
            </h2>
            <p className="text-gray-600 text-lg">
              Real-time data from PSX, updated every few minutes.
            </p>
          </div>

          {indexLoading ? (
            <div className="flex items-center justify-center h-64 rounded-2xl border-2 border-gray-300 bg-white shadow-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500">Loading indexes...</p>
              </div>
            </div>
          ) : indexes.length > 0 && currentIndex ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden">
                <div 
                  className="rounded-2xl border-2 border-gray-300 bg-white p-8 shadow-lg hover:shadow-xl transition-all duration-500 ease-out"
                  key={indexSlide}
                  style={{ animation: 'slideIn 0.5s ease-out' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Index</p>
                      <p className="text-4xl font-bold text-black">{currentIndex.index || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${parseFloat(currentIndex.change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(currentIndex.change) >= 0 ? '+' : ''}{currentIndex.change}
                      </p>
                      <p className={`text-lg font-medium ${parseFloat(currentIndex.percent_change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentIndex.percent_change}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Current</p>
                      <p className="text-2xl font-bold text-black mt-1">{currentIndex.current}</p>
                    </div>
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">High</p>
                      <p className="text-2xl font-bold text-black mt-1">{currentIndex.high}</p>
                    </div>
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Low</p>
                      <p className="text-2xl font-bold text-black mt-1">{currentIndex.low}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mt-6">
                    Last updated: {currentIndex.scraped_at ? new Date(currentIndex.scraped_at.$date).toLocaleString() : 'N/A'}
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
                      idx === indexSlide ? 'bg-blue-600 w-8' : 'bg-gray-300 w-2 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No indexes available</div>
          )}
        </div>
      </section>

      {/* Sectors Slideshow */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
              Explore Sectors
            </h2>
            <p className="text-gray-600 text-lg">
              Spot advances, declines, and market momentum by sector.
            </p>
          </div>

          {sectorLoading ? (
            <div className="flex items-center justify-center h-64 rounded-2xl border-2 border-gray-300 bg-white shadow-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500">Loading sectors...</p>
              </div>
            </div>
          ) : sectors.length > 0 && currentSector ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden">
                <div 
                  className="rounded-2xl border-2 border-gray-300 bg-white p-8 shadow-lg hover:shadow-xl transition-all duration-500 ease-out"
                  key={sectorSlide}
                  style={{ animation: 'slideIn 0.5s ease-out' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Sector</p>
                      <p className="text-3xl font-bold text-black">{currentSector.name}</p>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                      {currentSector.turnover}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-green-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Advance</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">{currentSector.advance}</p>
                    </div>
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-red-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Decline</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">{currentSector.decline}</p>
                    </div>
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-gray-400 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Unchanged</p>
                      <p className="text-2xl font-bold text-gray-700 mt-1">{currentSector.unchange || 0}</p>
                    </div>
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                      <p className="text-sm text-gray-600 font-medium">Market Cap</p>
                      <p className="text-2xl font-bold text-black mt-1">{currentSector.market_cap} B</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mt-6">
                    Last updated: {currentSector.scraped_at ? new Date(currentSector.scraped_at.$date).toLocaleString() : 'N/A'}
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
                      idx === sectorSlide ? 'bg-blue-600 w-8' : 'bg-gray-300 w-2 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No sectors available</div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              What StockSense Delivers
            </h2>
            <p className="text-gray-600 text-lg">
              Condensed from the system requirements specification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {featureBullets.map((item, idx) => (
              <div 
                key={item.title} 
                className="group p-8 bg-white rounded-2xl border-2 border-gray-300 shadow-md hover:border-blue-500 hover:shadow-2xl transition-all duration-300"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors duration-300">
                    <svg className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Timeline Section */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mb-4">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Your StockSense Flow
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              A smooth journey through intelligent investing in just five simple steps.
            </p>
          </div>

          {/* Modern Card Grid Layout */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {processSteps.map((step, idx) => {
              const IconComponent = step.icon;
              return (
                <div
                  key={idx}
                  className={`group relative p-8 bg-white rounded-2xl border-2 border-gray-200 shadow-sm hover:shadow-2xl hover:border-blue-500 hover:-translate-y-2 transition-all duration-500 ${
                    idx === 4 ? 'md:col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/40 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                    {idx + 1}
                  </div>
                  
                  {/* Icon Container */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-6 group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300">
                    <IconComponent className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors duration-300" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Decorative Arrow (except last) */}
                  {idx < processSteps.length - 1 && (
                    <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-300 hover:scale-105"
            >
              Start Your Journey
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* SRS Summary Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Why StockSense
            </h2>
            <p className="text-gray-600 text-lg">
              Understanding the core of our mission and commitment.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {srsSummary.map((item, idx) => (
              <div
                key={item.heading}
                className="group p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-300 shadow-md hover:border-blue-500 hover:shadow-2xl transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white font-bold">{idx + 1}</span>
                </div>
                <h3 className="text-lg font-bold text-blue-600 uppercase tracking-wide mb-3">
                  {item.heading}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Safety Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 mb-6 shadow-xl shadow-blue-600/30">
              <HiOutlineShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Our Stance on Privacy & Safety
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Your security and trust are our top priorities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { 
                icon: HiOutlineShieldCheck, 
                title: 'Simulation First',
                text: 'We run a simulation-first experience, avoiding live transactions and protecting your investment choices in a sandbox environment.',
                gradient: 'from-blue-500 to-cyan-500'
              },
              { 
                icon: HiOutlineLockClosed, 
                title: 'End-to-End Encryption',
                text: 'Your credentials are encrypted end-to-end. We never store plaintext passwords or payment details.',
                gradient: 'from-purple-500 to-pink-500'
              },
              { 
                icon: HiOutlineChartBar, 
                title: 'Transparent Data',
                text: 'All scraped market data comes from public sources and is treated transparently. Data refreshes every few minutes.',
                gradient: 'from-orange-500 to-amber-500'
              },
              { 
                icon: HiOutlineBell, 
                title: 'You\'re in Control',
                text: 'Alerts respect your notification preferences. You control what you see and when you see it.',
                gradient: 'from-green-500 to-emerald-500'
              },
            ].map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div 
                  key={idx} 
                  className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 shadow-sm hover:shadow-2xl hover:border-blue-400 transition-all duration-500 overflow-hidden"
                >
                  {/* Background Gradient Hover Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                  
                  <div className="relative z-10 flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-500 leading-relaxed">
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
      <section id="contact" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Get in Touch
            </h2>
            <p className="text-gray-600 text-lg">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <form className="space-y-6 bg-gray-50 p-8 rounded-2xl border-2 border-gray-300 shadow-lg">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                placeholder="What's this about?"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                rows={6}
                placeholder="Tell us more..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-500 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-300 hover:scale-[1.02]"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="StockSense Logo" 
                  className="w-10 h-10 object-contain"
                />
                <span className="text-xl font-bold">StockSense</span>
              </div>
              <p className="text-gray-400 text-sm">
                Intelligent investing for modern investors.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-300">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/dashboard" className="hover:text-white transition">Dashboard</Link></li>
                <li><Link to="/market-watch" className="hover:text-white transition">Market Watch</Link></li>
                <li><a href="#" className="hover:text-white transition">Portfolio</a></li>
                <li><a href="#" className="hover:text-white transition">Alerts</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-300">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Learning Center</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-300">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
              <p>&copy; 2025 StockSense. All rights reserved.</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
