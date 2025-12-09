import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchIndexes, fetchSectors } from '../api';

type LocationState = { scrollTo?: string; ts?: number } | null;

const processSteps = [
  {
    title: 'Add your desired stocks',
    description: 'Curate your portfolio with stocks that match your strategy',
  },
  {
    title: 'Watch predictions',
    description: 'See AI-driven price forecasts and sentiment-based signals',
  },
  {
    title: 'Take help with your assistant',
    description: 'Chat with your always-on advisor for guidance',
  },
  {
    title: 'Receive alerts',
    description: 'Stay informed with real-time notifications on moves',
  },
  {
    title: 'Learn about stocks',
    description: 'Build literacy through interactive courses and quizzes',
  },
];

const featureBullets = [
  {
    title: 'Real PSX coverage',
    text: 'Indexes, sectors, and market watch backed by scraped PSX data refreshed every few minutes.',
  },
  {
    title: 'Predictive intelligence',
    text: 'Price trends, sentiment, and confidence levels guiding buy / hold / sell signals.',
  },
  {
    title: 'Always-on assistant',
    text: 'Conversational advisor to explain moves, surface insights, and keep you on track.',
  },
  {
    title: 'Learning-first design',
    text: 'Micro-courses, quizzes, and progress tracking to build literacy alongside returns.',
  },
];

const srsSummary = [
  {
    heading: 'Problem',
    text: 'Retail investors lack a single, trustworthy PSX companion. Data is fragmented, tools are manual, and scams erode confidence.',
  },
  {
    heading: 'Solution',
    text: 'StockSense unifies scraped market data, predictive analytics, sentiment, alerts, and education in a safe simulation-first workspace.',
  },
  {
    heading: 'Objectives',
    text: 'Cross-platform app, ML recommendations, AI chatbot, education module, secure auth, and transparent data handling.',
  },
  {
    heading: 'Constraints',
    text: 'Dependent on scraper uptime, public data structures, network stability, and model accuracy; operates in a simulation environment.',
  },
];

export default function LandingPage() {
  const location = useLocation();
  const [indexes, setIndexes] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [indexSlide, setIndexSlide] = useState(0);
  const [sectorSlide, setSectorSlide] = useState(0);

  useEffect(() => {
    const state = (location.state as LocationState) || null;
    if (state?.scrollTo) {
      const el = document.getElementById(state.scrollTo);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      window.history.replaceState({}, document.title, '/');
    }
  }, [location]);

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

  const nextIndex = () => {
    if (indexes.length > 0) {
      setIndexSlide((prev) => (prev + 1) % indexes.length);
    }
  };

  const prevIndex = () => {
    if (indexes.length > 0) {
      setIndexSlide((prev) => (prev - 1 + indexes.length) % indexes.length);
    }
  };

  const nextSector = () => {
    if (sectors.length > 0) {
      setSectorSlide((prev) => (prev + 1) % sectors.length);
    }
  };

  const prevSector = () => {
    if (sectors.length > 0) {
      setSectorSlide((prev) => (prev - 1 + sectors.length) % sectors.length);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#050814] via-[#0a0f29] to-[#060817] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-accent-blue/15 blur-3xl animate-float" />
        <div className="absolute right-0 bottom-20 h-96 w-96 rounded-full bg-accent-green/10 blur-3xl animate-float-slow" />
        <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Hero */}
      <section id="home" className="relative mx-auto max-w-7xl px-4 pt-16 pb-24 lg:pt-24 lg:pb-32 z-10">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-8">

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                Stock Sense <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-blue-400">real PSX intelligence</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 max-w-2xl leading-relaxed">
                Track indexes, sectors, and market watch data, see predictive signals, chat with your assistant, and learn — all without risking capital.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-accent-blue to-blue-500 font-bold text-white shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-transform"
              >
                Create your account
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 rounded-xl border border-white/15 text-gray-200 bg-white/5 hover:border-accent-blue hover:text-white transition-all"
              >
                Login
              </Link>
            </div>
          </div>


        </div>
      </section>

      {/* Indexes Slideshow */}
      <section id="indexes" className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        <div className="flex items-start justify-between gap-6 flex-col lg:flex-row mb-10">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Track live indexes</h2>
            <p className="text-gray-300 text-lg">Real-time data from PSX, updated every few minutes.</p>
          </div>
        </div>

        {indexLoading ? (
          <div className="flex items-center justify-center h-80 rounded-3xl border border-white/10 bg-white/5">
            <p className="text-gray-400">Loading indexes...</p>
          </div>
        ) : indexes.length > 0 && currentIndex ? (
          <div className="relative space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl space-y-6">
              {/* Index Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-[0.25em]">Index</p>
                  <p className="text-4xl font-black text-white">{currentIndex.index || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${parseFloat(currentIndex.change) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {parseFloat(currentIndex.change) >= 0 ? '+' : ''}{currentIndex.change}
                  </p>
                  <p className={`text-lg ${parseFloat(currentIndex.percent_change) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {currentIndex.percent_change}
                  </p>
                </div>
              </div>

              {/* Range */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Low {currentIndex.low}</span>
                  <span>High {currentIndex.high}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 via-blue-400 to-accent-blue animate-gradient" />
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-3 text-sm text-gray-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Current</p>
                  <p className="font-semibold text-white text-lg">{currentIndex.current}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">High</p>
                  <p className="font-semibold text-white text-lg">{currentIndex.high}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Low</p>
                  <p className="font-semibold text-white text-lg">{currentIndex.low}</p>
                </div>
              </div>

              <p className="text-sm text-gray-400">
                Last updated: {currentIndex.scraped_at ? new Date(currentIndex.scraped_at.$date).toLocaleString() : 'N/A'}
              </p>
            </div>

            {/* Slideshow Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevIndex}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-2">
                {indexes.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setIndexSlide(idx)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      idx === indexSlide ? 'bg-accent-blue w-8' : 'bg-white/20 hover:bg-white/30'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextIndex}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">No indexes available</div>
        )}
      </section>

      {/* Sectors Slideshow */}
      <section id="sectors" className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        <div className="flex items-start justify-between gap-6 flex-col lg:flex-row mb-10">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Explore sectors</h2>
            <p className="text-gray-300 text-lg">Spot advances, declines, and market momentum by sector.</p>
          </div>
        </div>

        {sectorLoading ? (
          <div className="flex items-center justify-center h-80 rounded-3xl border border-white/10 bg-white/5">
            <p className="text-gray-400">Loading sectors...</p>
          </div>
        ) : sectors.length > 0 && currentSector ? (
          <div className="relative space-y-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-[#101628] to-[#0b0f1f] p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Sector Code {currentSector.code}</p>
                  <p className="text-3xl font-black text-white">{currentSector.name}</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-200 text-sm border border-emerald-400/30">
                  {currentSector.turnover} turnover
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-sm text-gray-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Advance</p>
                  <p className="text-2xl font-semibold text-emerald-300">{currentSector.advance}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Decline</p>
                  <p className="text-2xl font-semibold text-rose-300">{currentSector.decline}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Unchanged</p>
                  <p className="text-2xl font-semibold text-gray-300">{currentSector.unchange || 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-gray-400">Market Cap</p>
                  <p className="text-xl font-semibold text-white">{currentSector.market_cap} B</p>
                </div>
              </div>

              <p className="text-sm text-gray-400">
                Last updated: {currentSector.scraped_at ? new Date(currentSector.scraped_at.$date).toLocaleString() : 'N/A'}
              </p>
            </div>

            {/* Slideshow Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevSector}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-2">
                {sectors.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSectorSlide(idx)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      idx === sectorSlide ? 'bg-accent-blue w-8' : 'bg-white/20 hover:bg-white/30'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextSector}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">No sectors available</div>
        )}
      </section>

      {/* Live Market Info */}
      <section id="market-watch" className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white">Live market watch</h2>
            <p className="text-lg text-gray-300">
              Follow real-time stock movements across all indexes and sectors. Our data is refreshed continuously so you stay informed on every market move.
            </p>
          </div>

          <Link
            to="/market-watch"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-accent-blue to-blue-500 font-semibold text-white shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-transform"
          >
            Explore Market Watch
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* Process Timeline - Animated */}
      <section id="process" className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black">Your StockSense flow</h2>
          <p className="text-gray-300 text-lg">A smooth journey through intelligent investing.</p>
        </div>

        <div className="relative">
          {/* Animated vertical line */}
          <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-gradient-to-b from-accent-blue via-white/40 to-accent-green animate-line" />

          {/* Steps */}
          <div className="space-y-12">
            {processSteps.map((step, idx) => (
              <div key={step.title} className="relative flex flex-col items-center">
                {/* Circle indicator */}
                <div className="relative z-20 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue to-blue-500 border-4 border-[#050814] text-white font-black text-xl shadow-lg shadow-blue-500/50 animate-pulse">
                  {idx + 1}
                </div>

                {/* Content - alternates left/right */}
                <div className={`mt-8 w-full max-w-md ${idx % 2 === 0 ? 'ml-auto' : 'mr-auto'}`}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur animate-slide-up">
                    <p className="text-xl font-black text-white">{step.title}</p>
                    <p className="text-sm text-gray-300 mt-2">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product intro */}
      <section id="blogs" className="relative mx-auto max-w-7xl px-4 pb-20 z-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white">What StockSense delivers</h2>
            <p className="text-lg text-gray-300">Condensed from the system requirements specification.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {featureBullets.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-2">
                <p className="text-xl font-semibold text-white">{item.title}</p>
                <p className="text-gray-300 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {srsSummary.map((item) => (
              <div key={item.heading} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-5">
                <p className="text-sm uppercase tracking-wide text-gray-400">{item.heading}</p>
                <p className="text-gray-200 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <p className="text-lg font-semibold text-white">Our stance on privacy & safety</p>
            <p className="text-gray-300 leading-relaxed">
              We run a simulation-first experience, avoid handling live transactions, encrypt credentials, and keep scraped data transparent. Data refreshes every few minutes, and alerts respect your notification preferences.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative mx-auto max-w-6xl px-4 pb-24 z-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="lg:w-1/2 space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Contact</p>
              <h3 className="text-3xl font-black text-white">Tell us what you need</h3>
              <p className="text-gray-300">Questions about the data, roadmap requests, or partnership ideas — drop a note.</p>

              <div className="space-y-2 text-gray-200">
                <p>support@stocksense.pk</p>
                <p>+92 (000) 123 4567</p>
              </div>
            </div>

            <form
              className="lg:w-1/2 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" placeholder="Ayesha Khan" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" type="email" placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white min-h-[140px]" placeholder="Share your idea or request" required />
              </div>
              <button
                type="submit"
                className="justify-self-start px-6 py-3 rounded-xl bg-gradient-to-r from-accent-blue to-blue-500 font-semibold text-white shadow-lg shadow-blue-500/25"
              >
                Send message
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/5 bg-[#050814]/80 backdrop-blur py-8 z-10">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-400 text-sm">
          <p>StockSense © 2025 — Built for Pakistani investors.</p>
          <div className="flex items-center gap-4">
            <span>Privacy-first</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Simulation mode</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Secure auth</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
