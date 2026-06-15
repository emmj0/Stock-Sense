import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../providers/AuthProvider';
import { Mail, Lock, User, ArrowRight, CheckCircle2, X, AlertCircle } from 'lucide-react';

type Mode = 'login' | 'signup';

interface AuthModalCtx { openAuth: (mode?: Mode) => void; closeAuth: () => void; }
const Ctx = createContext<AuthModalCtx | undefined>(undefined);

export function useAuthModal() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuthModal must be used within AuthModalProvider');
  return c;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');

  const openAuth = useCallback((m: Mode = 'login') => { setMode(m); setOpen(true); }, []);
  const closeAuth = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openAuth, closeAuth }}>
      {children}
      <AuthModal open={open} mode={mode} setMode={setMode} onClose={closeAuth} />
    </Ctx.Provider>
  );
}

function AuthModal({ open, mode, setMode, onClose }: {
  open: boolean; mode: Mode; setMode: (m: Mode) => void; onClose: () => void;
}) {
  const { authenticateWithPassword, authenticateWithGoogle, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  // reset transient state whenever the modal opens or the mode changes
  useEffect(() => { setError(''); setLoading(false); }, [open, mode]);

  // lock body scroll + close on Escape while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const finish = () => { onClose(); setName(''); setEmail(''); setPassword(''); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await register(name, email, password);
        finish();
        navigate('/preferences');
      } else {
        await authenticateWithPassword(email, password);
        finish();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || (isSignup ? 'Unable to sign up' : 'Unable to login'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      await authenticateWithGoogle(credential);
      finish();
      navigate(isSignup ? '/preferences' : '/dashboard');
    } catch {
      setError('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  // password strength (signup only)
  const strength = (() => {
    if (!password) return { n: 0, label: '', color: 'bg-slate-200' };
    if (password.length < 6) return { n: 1, label: 'Weak', color: 'bg-red-500' };
    if (password.length < 8) return { n: 2, label: 'Fair', color: 'bg-amber-500' };
    if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { n: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { n: 3, label: 'Good', color: 'bg-sky-500' };
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <X size={18} />
        </button>

        <div className="px-7 sm:px-8 pt-8 pb-7">
          {/* Logo + heading */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="StockSense" className="w-9 h-9 object-contain" />
              <span className="font-display text-lg font-bold text-slate-900 tracking-tight">StockSense<span className="text-brand-500">.</span></span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="text-slate-500 text-sm mt-1">{isSignup ? 'Start your intelligent investing journey' : 'Sign in to manage your PSX portfolio'}</p>
          </div>

          {/* Segmented toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                  <input className="input pl-11" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input className="input pl-11" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input className="input pl-11" type="password" placeholder={isSignup ? 'Create a strong password' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              {isSignup && password.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4].map(l => <div key={l} className={`h-1.5 flex-1 rounded-full transition-all ${l <= strength.n ? strength.color : 'bg-slate-200'}`} />)}
                  </div>
                  <div className="space-y-1">
                    {[
                      { ok: password.length >= 8, t: 'At least 8 characters' },
                      { ok: /[A-Z]/.test(password), t: 'One uppercase letter' },
                      { ok: /\d/.test(password), t: 'One number' },
                    ].map((r, i) => (
                      <p key={i} className={`text-xs flex items-center gap-1.5 ${r.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className={`w-3.5 h-3.5 ${r.ok ? 'text-emerald-500' : 'text-slate-300'}`} /> {r.t}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full group">
              {loading
                ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {isSignup ? 'Creating account…' : 'Signing in…'}</>
                : <>{isSignup ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">or continue with</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(cred) => { if (cred.credential) handleGoogle(cred.credential); }}
              onError={() => setError('Google sign-in failed')}
              shape="pill"
              text={isSignup ? 'signup_with' : 'continue_with'}
            />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setMode(isSignup ? 'login' : 'signup')} className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              {isSignup ? 'Sign in' : 'Create one free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
