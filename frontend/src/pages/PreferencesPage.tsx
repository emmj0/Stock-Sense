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
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-black mb-4">
            Personalize Your Experience
          </h1>
          <p className="text-lg text-gray-600">
            Tell us about your investing style so we can show you the most relevant stocks and insights.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl bg-white border border-gray-200 p-8 md:p-12 shadow-sm">
          <form className="space-y-10" onSubmit={handleSubmit}>
            {/* Risk Tolerance */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-semibold text-black mb-2 block">
                  Risk Tolerance
                </span>
                <p className="text-sm text-gray-600">How much volatility can you handle?</p>
              </label>
              <div className="grid gap-3">
                {[
                  { value: 'conservative', label: 'Conservative', desc: 'Prefer stable, lower-volatility stocks' },
                  { value: 'moderate', label: 'Moderate', desc: 'Balanced between growth and stability' },
                  { value: 'aggressive', label: 'Aggressive', desc: 'Comfortable with high volatility for potential gains' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      prefs.riskTolerance === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="risk"
                      value={option.value}
                      checked={prefs.riskTolerance === option.value}
                      onChange={(e) => update('riskTolerance', e.target.value as Preferences['riskTolerance'])}
                      className="w-5 h-5 accent-blue-600"
                    />
                    <div className="ml-4">
                      <p className="font-semibold text-black">{option.label}</p>
                      <p className="text-sm text-gray-600">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Investment Horizon */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-semibold text-black mb-2 block">
                  Investment Horizon
                </span>
                <p className="text-sm text-gray-600">How long do you plan to hold your stocks?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.investmentHorizon || ''}
                onChange={(e) => update('investmentHorizon', e.target.value)}
              >
                <option value="">Select time horizon...</option>
                <option value="Less than 6 months">Less than 6 months</option>
                <option value="6-12 months">6-12 months</option>
                <option value="1-3 years">1-3 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="5+ years">5+ years</option>
              </select>
            </div>

            {/* Market Cap Focus */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-semibold text-black mb-2 block">
                  Market Cap Focus
                </span>
                <p className="text-sm text-gray-600">What size companies interest you?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.marketCapFocus || ''}
                onChange={(e) => update('marketCapFocus', e.target.value)}
              >
                <option value="">Select market cap focus...</option>
                <option value="Large-cap">Large-cap (Established blue chips)</option>
                <option value="Mid-cap">Mid-cap (Growing companies)</option>
                <option value="Small-cap">Small-cap (High growth potential)</option>
                <option value="Mixed">Mixed (No preference)</option>
              </select>
            </div>

            {/* Dividend Preference */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-semibold text-black mb-2 block">
                  Dividend Preference
                </span>
                <p className="text-sm text-gray-600">How do you prefer to receive dividends?</p>
              </label>
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px'}}
                value={prefs.dividendPreference || ''}
                onChange={(e) => update('dividendPreference', e.target.value)}
              >
                <option value="">Select dividend preference...</option>
                <option value="Cash out">Cash out (Receive dividends as cash)</option>
                <option value="Reinvest dividends">Reinvest dividends (Compound your growth)</option>
                <option value="No preference">No preference</option>
              </select>
            </div>

            {/* Sectors */}
            <div>
              <label className="block mb-5">
                <span className="text-lg font-semibold text-black mb-2 block">
                  Preferred Sectors
                </span>
                <p className="text-sm text-gray-600">Which industries interest you most? (Select at least one)</p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {sectorOptions.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all border ${
                      (prefs.sectors || []).includes(sector)
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving your preferences...' : 'Continue to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
