import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchIndexes, fetchSectors } from '../api';

const processSteps = [
  { title: 'Add your desired stocks', description: 'Curate your portfolio with stocks that match your strategy' },
  { title: 'Watch predictions', description: 'See AI-driven price forecasts and sentiment-based signals' },
  { title: 'Take help with your assistant', description: 'Chat with your always-on advisor for guidance' },
  { title: 'Receive alerts', description: 'Stay informed with real-time notifications on moves' },
  { title: 'Learn about stocks', description: 'Build literacy through interactive courses and quizzes' },
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

export default function LandingPage() {
  const [indexes, setIndexes] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [indexSlide, setIndexSlide] = useState(0);
  const [sectorSlide, setSectorSlide] = useState(0);

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
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              Stock Sense
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl">
              Real-time PSX market data, AI-driven predictions, and your always-on financial advisor
            </p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Track indexes, sectors, and market watch data, see predictive signals, chat with your assistant, and learn — all without risking capital.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              to="/signup"
              className="px-8 py-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/market-watch"
              className="px-8 py-4 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Explore Market Watch
            </Link>
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
            <div className="flex items-center justify-center h-64 rounded-xl border border-gray-200 bg-white">
              <p className="text-gray-500">Loading indexes...</p>
            </div>
          ) : indexes.length > 0 && currentIndex ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Current</p>
                    <p className="text-2xl font-bold text-black mt-1">{currentIndex.current}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">High</p>
                    <p className="text-2xl font-bold text-black mt-1">{currentIndex.high}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Low</p>
                    <p className="text-2xl font-bold text-black mt-1">{currentIndex.low}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                  Last updated: {currentIndex.scraped_at ? new Date(currentIndex.scraped_at.$date).toLocaleString() : 'N/A'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIndexSlide((p) => (p - 1 + indexes.length) % indexes.length)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-black hover:bg-gray-50 transition-colors font-medium"
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-2">
                  {indexes.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setIndexSlide(idx)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        idx === indexSlide ? 'bg-blue-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setIndexSlide((p) => (p + 1) % indexes.length)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-black hover:bg-gray-50 transition-colors font-medium"
                >
                  Next →
                </button>
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
            <div className="flex items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50">
              <p className="text-gray-500">Loading sectors...</p>
            </div>
          ) : sectors.length > 0 && currentSector ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Advance</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{currentSector.advance}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Decline</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{currentSector.decline}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Unchanged</p>
                    <p className="text-2xl font-bold text-gray-700 mt-1">{currentSector.unchange || 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 font-medium">Market Cap</p>
                    <p className="text-2xl font-bold text-black mt-1">{currentSector.market_cap} B</p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                  Last updated: {currentSector.scraped_at ? new Date(currentSector.scraped_at.$date).toLocaleString() : 'N/A'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSectorSlide((p) => (p - 1 + sectors.length) % sectors.length)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-black hover:bg-gray-50 transition-colors font-medium"
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-2">
                  {sectors.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSectorSlide(idx)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        idx === sectorSlide ? 'bg-blue-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setSectorSlide((p) => (p + 1) % sectors.length)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-black hover:bg-gray-50 transition-colors font-medium"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No sectors available</div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              What StockSense Delivers
            </h2>
            <p className="text-gray-600 text-lg">
              Condensed from the system requirements specification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {featureBullets.map((item) => (
              <div key={item.title} className="space-y-3">
                <h3 className="text-xl sm:text-2xl font-bold">{item.title}</h3>
                <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Timeline Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Your StockSense Flow
            </h2>
            <p className="text-gray-600 text-lg">
              A smooth journey through intelligent investing.
            </p>
          </div>

          <div className="space-y-12 sm:space-y-16">
            {processSteps.map((step, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  idx % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                } gap-8 items-center`}
              >
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-2xl">
                    {idx + 1}
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-base sm:text-lg">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
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
            {srsSummary.map((item) => (
              <div
                key={item.heading}
                className="space-y-4 p-8 bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
              >
                <h3 className="text-lg font-bold text-blue-600 uppercase tracking-wide">
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
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Our Stance on Privacy & Safety
            </h2>
          </div>

          <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              We run a simulation-first experience, avoiding live transactions and protecting your investment choices in a sandbox environment.
            </p>
            <p>
              Your credentials are encrypted end-to-end. We never store plaintext passwords or payment details.
            </p>
            <p>
              All scraped market data comes from public sources and is treated transparently. Data refreshes every few minutes, keeping you current without overwhelming notifications.
            </p>
            <p>
              Alerts respect your notification preferences. You control what you see and when you see it.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Get in Touch
            </h2>
            <p className="text-gray-600 text-lg">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500"
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                placeholder="What's this about?"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500"
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
              <h3 className="text-lg font-bold">StockSense</h3>
              <p className="text-gray-400 text-sm">
                Intelligent investing for modern investors.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Dashboard</a></li>
                <li><a href="#" className="hover:text-white transition">Market Watch</a></li>
                <li><a href="#" className="hover:text-white transition">Portfolio</a></li>
                <li><a href="#" className="hover:text-white transition">Alerts</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Learning Center</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
              <p>&copy; 2025 StockSense. All rights reserved.</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-white transition">Twitter</a>
                <a href="#" className="hover:text-white transition">LinkedIn</a>
                <a href="#" className="hover:text-white transition">GitHub</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
