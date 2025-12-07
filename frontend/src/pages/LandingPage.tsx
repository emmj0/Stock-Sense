import { Link } from 'react-router-dom';

export default function LandingPage() {
  const sampleStocks = [
    { label: 'LPL', value: '24.33', delta: '-6.06%', change: -6.06 },
    { label: 'PTC', value: '43.92', delta: '+4.95%', change: 4.95 },
    { label: 'THCCL', value: '83.91', delta: '-2.32%', change: -2.32 },
    { label: 'FNEL', value: '20.19', delta: '+4.13%', change: 4.13 },
    { label: 'PIAHCLA', value: '41.61', delta: '+9.53%', change: 9.53 },
  ];

  const features = [
    {
      title: '🔐 Secure Login',
      description: 'Email/password or Google OAuth. Your credentials stay safe and encrypted.',
    },
    {
      title: '📊 Personalized Preferences',
      description: 'Set risk tolerance, investment horizon, sectors, and dividend preferences.',
    },
    {
      title: '📈 Live PSX Data',
      description: 'Browse real-time stock data scraped from PSX and stored in MongoDB.',
    },
    {
      title: '💼 Manage Portfolio',
      description: 'Add stocks, track quantities, and monitor your holdings in one place.',
    },
    {
      title: '🔍 Smart Search',
      description: 'Quickly find stocks by symbol and build your personalized watchlist.',
    },
    {
      title: '💬 Chatbot & Learn',
      description: 'Coming soon: AI chatbot and stock learning resources (Coming Q2 2025).',
    },
  ];

  return (
    <main className="min-h-screen bg-dark-bg text-white overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-green/10 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl px-4 py-20 md:py-32 z-10">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent-blue/20 px-4 py-2 border border-accent-blue/50 backdrop-blur">
                <span className="text-lg">✨</span>
                <p className="text-sm font-semibold text-accent-blue">PSX Stocks · Smart Investing</p>
              </div>
              <h1 className="text-6xl md:text-7xl font-black leading-tight text-white">
                Build Your <span className="bg-gradient-to-r from-accent-blue via-blue-400 to-accent-blue bg-clip-text text-transparent">PSX Portfolio</span>
              </h1>
              <p className="text-xl text-gray-300 max-w-xl leading-relaxed">
                Professional stock portfolio management with real-time PSX data, smart preferences, and secure authentication.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                to="/signup"
                className="px-8 py-4 bg-gradient-to-r from-accent-blue to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-accent-blue/50 transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Get Started
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-dark-card border-2 border-dark-border text-gray-300 font-bold rounded-xl hover:border-accent-blue hover:text-white transition-all duration-300 backdrop-blur"
              >
                Sign In
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-6 pt-8">
              <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <div className="p-2 rounded-lg bg-dark-card border border-dark-border">
                  <span className="text-xl">🔒</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-300">Secure Auth</p>
                  <p className="text-xs text-gray-500">JWT + Google OAuth</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <div className="p-2 rounded-lg bg-dark-card border border-dark-border">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-300">Real Data</p>
                  <p className="text-xs text-gray-500">Live PSX Stocks</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <div className="p-2 rounded-lg bg-dark-card border border-dark-border">
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-300">Fast & Easy</p>
                  <p className="text-xs text-gray-500">Built with Vite</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Stock Cards */}
          <div className="relative">
            {/* Floating Background */}
            <div className="absolute -inset-4 bg-gradient-to-br from-accent-blue/20 to-accent-green/20 rounded-3xl blur-2xl opacity-60" />
            
            {/* Main Card */}
            <div className="relative rounded-3xl bg-gradient-to-br from-dark-card/90 to-dark-bg/90 backdrop-blur-xl p-8 border border-dark-border shadow-2xl">
              <div className="space-y-6">
                {/* Header */}
                <div className="pb-6 border-b border-dark-border/50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Today's PSX Market</p>
                  <p className="text-2xl font-black text-white mt-2">Featured Stocks</p>
                </div>

                {/* Stock List */}
                <div className="space-y-3">
                  {sampleStocks.map((stock, idx) => (
                    <div
                      key={stock.label}
                      className="group flex items-center justify-between p-4 rounded-xl bg-dark-border/30 hover:bg-dark-border/60 transition-all duration-300 border border-dark-border/50 hover:border-accent-blue/50 backdrop-blur"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg group-hover:text-accent-blue transition-colors">{stock.label}</p>
                        <p className="text-sm text-gray-400">Rs {stock.value}</p>
                      </div>
                      <div className={`text-right`}>
                        <p className={`font-black text-lg ${stock.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          {stock.delta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-dark-border/50">
                  <p className="text-xs text-gray-500 text-center">Real-time data from Pakistan Stock Exchange</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative mx-auto max-w-6xl px-4 py-24 z-10">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-4">Everything You Need</h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
            A complete platform for managing your PSX investments with real data, smart tools, and professional features.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="group p-8 rounded-2xl bg-gradient-to-br from-dark-card/80 to-dark-bg/80 border border-dark-border hover:border-accent-blue/50 hover:shadow-xl hover:shadow-accent-blue/10 transition-all duration-300 backdrop-blur cursor-pointer"
            >
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{feature.title.split(' ')[0]}</div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-accent-blue transition-colors">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative mx-auto max-w-4xl px-4 py-24 z-10">
        <div className="rounded-3xl bg-gradient-to-br from-accent-blue/20 via-accent-blue/10 to-dark-card border border-accent-blue/30 p-12 text-center backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-96 h-96 bg-accent-blue rounded-full filter blur-3xl animate-pulse" />
          </div>

          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Ready to Start Investing?</h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join investors managing their PSX portfolio with confidence. Sign up in seconds and start building wealth.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-accent-blue font-bold rounded-xl hover:shadow-2xl hover:shadow-white/20 transition-all duration-300 group"
            >
              Create Your Account Now
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-dark-border/30 bg-dark-card/50 backdrop-blur py-8 z-10">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-gray-400 text-sm mb-2">StockSense © 2024 · Manage your PSX portfolio with confidence</p>
          <p className="text-gray-600 text-xs">Built with React • Vite • Tailwind CSS • MongoDB</p>
        </div>
      </footer>
    </main>
  );
}
