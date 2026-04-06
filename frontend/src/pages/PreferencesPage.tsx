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
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Personalize Your Experience
          </h1>
          <p className="text-base text-slate-600">
            Tell us about your investing style so we can show you the most relevant stocks and insights.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 md:p-8 shadow-sm">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Risk Tolerance */}
            <div>
              <label className="block mb-3">
                <span className="text-base font-bold text-slate-900 mb-1 block">
                  Risk Tolerance
                </span>
                <p className="text-xs text-slate-500">How much volatility can you handle?</p>
              </label>
              <div className="grid gap-2.5">
                {[
                  { value: 'conservative', label: 'Conservative', desc: 'Prefer stable, lower-volatility stocks' },
                  { value: 'moderate', label: 'Moderate', desc: 'Balanced between growth and stability' },
                  { value: 'aggressive', label: 'Aggressive', desc: 'Comfortable with high volatility for potential gains' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      prefs.riskTolerance === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="risk"
                      value={option.value}
                      checked={prefs.riskTolerance === option.value}
                      onChange={(e) => update('riskTolerance', e.target.value as Preferences['riskTolerance'])}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div className="ml-3">
                      <p className="font-semibold text-slate-900 text-sm">{option.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Investment Horizon */}
            <div>
              <label className="block mb-3">
                <span className="text-base font-bold text-slate-900 mb-1 block">
                  Investment Horizon
                </span>
                <p className="text-xs text-slate-500">How long do you plan to hold your stocks?</p>
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-300 transition-all appearance-none text-sm"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '18px', paddingRight: '36px'}}
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
              <label className="block mb-3">
                <span className="text-base font-bold text-slate-900 mb-1 block">
                  Market Cap Focus
                </span>
                <p className="text-xs text-slate-500">What size companies interest you?</p>
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-300 transition-all appearance-none text-sm"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '18px', paddingRight: '36px'}}
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
              <label className="block mb-3">
                <span className="text-base font-bold text-slate-900 mb-1 block">
                  Dividend Preference
                </span>
                <p className="text-xs text-slate-500">How do you prefer to receive dividends?</p>
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-300 transition-all appearance-none text-sm"
                style={{backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '18px', paddingRight: '36px'}}
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
              <label className="block mb-3">
                <span className="text-base font-bold text-slate-900 mb-1 block">
                  Preferred Sectors
                </span>
                <p className="text-xs text-slate-500">Which industries interest you most? (Select at least one)</p>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sectorOptions.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all border ${
                      (prefs.sectors || []).includes(sector)
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Saving your preferences...' : 'Continue to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
