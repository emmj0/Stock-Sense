import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPreferences, savePreferences } from '../api';
import type { Preferences } from '../types';

const defaultPrefs: Preferences = {
  riskTolerance: 'moderate',
  sectors: ['Technology', 'Energy'],
  investmentHorizon: '1-3 years',
  marketCapFocus: 'Mid-cap',
  dividendPreference: 'Reinvest dividends',
};

const sectorOptions = [
  'Technology',
  'Energy',
  'Telecommunications',
  'Financial Services',
  'Materials',
  'Consumer Goods',
  'Healthcare',
  'Utilities',
  'Real Estate',
  'Agriculture',
];

export default function PreferencesPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPreferences()
      .then((p) => p && setPrefs({ ...defaultPrefs, ...p }))
      .catch(() => {})
      .finally(() => {});
  }, []);

  const update = (key: keyof Preferences, value: any) => setPrefs((prev) => ({ ...prev, [key]: value }));

  const toggleSector = (sector: string) => {
    const current = prefs.sectors || [];
    const updated = current.includes(sector)
      ? current.filter((s) => s !== sector)
      : [...current, sector];
    update('sectors', updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await savePreferences(prefs);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-bg py-12 px-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-green/10 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4">Personalize Your Experience</h1>
          <p className="text-lg text-gray-400 leading-relaxed">
            Tell us about your investing style so we can show you the most relevant stocks and insights.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-3xl bg-gradient-to-br from-dark-card/90 to-dark-bg/90 border border-dark-border p-8 md:p-12 backdrop-blur shadow-2xl">
          <form className="space-y-10" onSubmit={handleSubmit}>
            {/* Risk Tolerance */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-3xl">⚠️</span>
                  Risk Tolerance
                </span>
                <p className="text-sm text-gray-400 mt-1">How much volatility can you handle?</p>
              </label>
              <div className="grid gap-3">
                {[
                  { value: 'conservative', label: 'Conservative', desc: 'Prefer stable, lower-volatility stocks' },
                  { value: 'moderate', label: 'Moderate', desc: 'Balanced between growth and stability' },
                  { value: 'aggressive', label: 'Aggressive', desc: 'Comfortable with high volatility for potential gains' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      prefs.riskTolerance === option.value
                        ? 'border-accent-blue bg-accent-blue/20 shadow-lg shadow-accent-blue/20'
                        : 'border-dark-border bg-dark-border/30 hover:border-dark-border/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="risk"
                      value={option.value}
                      checked={prefs.riskTolerance === option.value}
                      onChange={(e) => update('riskTolerance', e.target.value as Preferences['riskTolerance'])}
                      className="w-5 h-5 accent-accent-blue"
                    />
                    <div className="ml-4">
                      <p className="font-bold text-white">{option.label}</p>
                      <p className="text-sm text-gray-400">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Investment Horizon */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-3xl">⏱️</span>
                  Investment Horizon
                </span>
                <p className="text-sm text-gray-400 mt-1">How long do you plan to hold your stocks?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl border-2 border-dark-border bg-dark-bg text-white focus:border-accent-blue focus:outline-none transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.investmentHorizon || ''}
                onChange={(e) => update('investmentHorizon', e.target.value)}
              >
                <option value="" className="bg-dark-bg">Select time horizon...</option>
                <option value="Less than 6 months" className="bg-dark-bg">Less than 6 months</option>
                <option value="6-12 months" className="bg-dark-bg">6-12 months</option>
                <option value="1-3 years" className="bg-dark-bg">1-3 years</option>
                <option value="3-5 years" className="bg-dark-bg">3-5 years</option>
                <option value="5+ years" className="bg-dark-bg">5+ years</option>
              </select>
            </div>

            {/* Market Cap Focus */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-3xl">📊</span>
                  Market Cap Focus
                </span>
                <p className="text-sm text-gray-400 mt-1">What size companies interest you?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl border-2 border-dark-border bg-dark-bg text-white focus:border-accent-blue focus:outline-none transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.marketCapFocus || ''}
                onChange={(e) => update('marketCapFocus', e.target.value)}
              >
                <option value="" className="bg-dark-bg">Select market cap focus...</option>
                <option value="Large-cap" className="bg-dark-bg">Large-cap (Established blue chips)</option>
                <option value="Mid-cap" className="bg-dark-bg">Mid-cap (Growing companies)</option>
                <option value="Small-cap" className="bg-dark-bg">Small-cap (High growth potential)</option>
                <option value="Mixed" className="bg-dark-bg">Mixed (No preference)</option>
              </select>
            </div>

            {/* Dividend Preference */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-3xl">💰</span>
                  Dividend Preference
                </span>
                <p className="text-sm text-gray-400 mt-1">How do you prefer to receive dividends?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl border-2 border-dark-border bg-dark-bg text-white focus:border-accent-blue focus:outline-none transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.dividendPreference || ''}
                onChange={(e) => update('dividendPreference', e.target.value)}
              >
                <option value="" className="bg-dark-bg">Select dividend preference...</option>
                <option value="Cash out" className="bg-dark-bg">Cash out (Receive dividends as cash)</option>
                <option value="Reinvest dividends" className="bg-dark-bg">Reinvest dividends (Compound your growth)</option>
                <option value="No preference" className="bg-dark-bg">No preference</option>
              </select>
            </div>

            {/* Sectors */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-3xl">🏭</span>
                  Preferred Sectors
                </span>
                <p className="text-sm text-gray-400 mt-1">Which industries interest you most? (Select at least one)</p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {sectorOptions.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`px-4 py-3 rounded-xl font-bold transition-all border-2 ${
                      (prefs.sectors || []).includes(sector)
                        ? 'border-accent-blue bg-accent-blue text-white shadow-lg shadow-accent-blue/30'
                        : 'border-dark-border bg-dark-border/30 text-gray-300 hover:border-dark-border/70'
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 backdrop-blur">
                <p className="text-sm text-accent-red font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-accent-blue to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-accent-blue/50 disabled:opacity-60 transition-all text-lg"
            >
              {loading ? 'Saving your preferences...' : '✓ Continue to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
