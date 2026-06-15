import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPreferences, savePreferences } from '../api';
import { SlidersHorizontal, ShieldCheck, Clock, Building2, Coins, Layers, ArrowRight } from 'lucide-react';
import type { Preferences } from '../types';

const defaultPrefs: Preferences = {
  riskTolerance: 'moderate',
  sectors: ['Technology', 'Energy'],
  investmentHorizon: '1-3 years',
  marketCapFocus: 'Mid-cap',
  dividendPreference: 'Reinvest dividends',
};

const sectorOptions = ['Technology', 'Energy', 'Telecommunications', 'Financial Services', 'Materials', 'Consumer Goods', 'Healthcare', 'Utilities', 'Real Estate', 'Agriculture'];

const selectStyle = {
  backgroundImage: 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>)',
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: '38px',
} as const;

export default function PreferencesPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPreferences().then((p) => p && setPrefs({ ...defaultPrefs, ...p })).catch(() => {});
  }, []);

  const update = (key: keyof Preferences, value: any) => setPrefs((prev) => ({ ...prev, [key]: value }));
  const toggleSector = (sector: string) => {
    const current = prefs.sectors || [];
    update('sectors', current.includes(sector) ? current.filter((s) => s !== sector) : [...current, sector]);
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
    <main className="page max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8 reveal">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
          <SlidersHorizontal size={24} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Personalize your experience</h1>
        <p className="text-slate-500">Tell us about your investing style so we can surface the most relevant stocks and insights.</p>
      </div>

      <div className="card p-6 md:p-8 reveal stagger-1">
        <form className="space-y-7" onSubmit={handleSubmit}>
          {/* Risk Tolerance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-brand-500" />
              <span className="text-base font-bold text-slate-900">Risk Tolerance</span>
            </div>
            <div className="grid gap-2.5">
              {[
                { value: 'conservative', label: 'Conservative', desc: 'Prefer stable, lower-volatility stocks' },
                { value: 'moderate', label: 'Moderate', desc: 'Balanced between growth and stability' },
                { value: 'aggressive', label: 'Aggressive', desc: 'Comfortable with high volatility for potential gains' },
              ].map((option) => {
                const active = prefs.riskTolerance === option.value;
                return (
                  <label key={option.value} className={`flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all ${active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="risk" value={option.value} checked={active} onChange={(e) => update('riskTolerance', e.target.value as Preferences['riskTolerance'])} className="w-4 h-4 accent-brand-500" />
                    <div className="ml-3">
                      <p className="font-semibold text-slate-900 text-sm">{option.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Horizon */}
          <div>
            <div className="flex items-center gap-2 mb-3"><Clock size={16} className="text-sky-500" /><span className="text-base font-bold text-slate-900">Investment Horizon</span></div>
            <select className="input appearance-none" style={selectStyle} value={prefs.investmentHorizon || ''} onChange={(e) => update('investmentHorizon', e.target.value)}>
              <option value="">Select time horizon…</option>
              <option>Less than 6 months</option><option>6-12 months</option><option>1-3 years</option><option>3-5 years</option><option>5+ years</option>
            </select>
          </div>

          {/* Market cap */}
          <div>
            <div className="flex items-center gap-2 mb-3"><Building2 size={16} className="text-violet-500" /><span className="text-base font-bold text-slate-900">Market Cap Focus</span></div>
            <select className="input appearance-none" style={selectStyle} value={prefs.marketCapFocus || ''} onChange={(e) => update('marketCapFocus', e.target.value)}>
              <option value="">Select market cap focus…</option>
              <option value="Large-cap">Large-cap (Established blue chips)</option>
              <option value="Mid-cap">Mid-cap (Growing companies)</option>
              <option value="Small-cap">Small-cap (High growth potential)</option>
              <option value="Mixed">Mixed (No preference)</option>
            </select>
          </div>

          {/* Dividend */}
          <div>
            <div className="flex items-center gap-2 mb-3"><Coins size={16} className="text-emerald-500" /><span className="text-base font-bold text-slate-900">Dividend Preference</span></div>
            <select className="input appearance-none" style={selectStyle} value={prefs.dividendPreference || ''} onChange={(e) => update('dividendPreference', e.target.value)}>
              <option value="">Select dividend preference…</option>
              <option value="Cash out">Cash out (Receive dividends as cash)</option>
              <option value="Reinvest dividends">Reinvest dividends (Compound your growth)</option>
              <option value="No preference">No preference</option>
            </select>
          </div>

          {/* Sectors */}
          <div>
            <div className="flex items-center gap-2 mb-3"><Layers size={16} className="text-brand-500" /><span className="text-base font-bold text-slate-900">Preferred Sectors</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sectorOptions.map((sector) => {
                const active = (prefs.sectors || []).includes(sector);
                return (
                  <button key={sector} type="button" onClick={() => toggleSector(sector)}
                    className={`px-3 py-2 rounded-xl font-medium text-sm transition-all border ${active ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/25' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
                    {sector}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-red-700 font-medium">{error}</p></div>}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Saving your preferences…' : <>Continue to Dashboard <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </main>
  );
}
