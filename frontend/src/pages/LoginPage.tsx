import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../providers/AuthProvider';

export default function LoginPage() {
  const { authenticateWithPassword, authenticateWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authenticateWithPassword(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      await authenticateWithGoogle(credential);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-bg flex items-center py-12 px-4">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">👋 Welcome Back</h1>
          <p className="text-gray-400">Sign in to manage your PSX portfolio</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
          {/* Email/Password Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                📧 Email Address
              </label>
              <input
                className="w-full px-4 py-3 rounded-lg border-2 border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                🔐 Password
              </label>
              <input
                className="w-full px-4 py-3 rounded-lg border-2 border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 backdrop-blur">
                <p className="text-accent-red text-sm font-medium">⚠️ {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-accent-blue text-white font-bold rounded-lg hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading ? '⟳ Signing in...' : '✓ Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-dark-border" />
            <span className="text-sm text-gray-400 font-medium">or</span>
            <div className="h-px flex-1 bg-dark-border" />
          </div>

          {/* Google Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(cred) => {
                if (cred.credential) {
                  handleGoogleSuccess(cred.credential);
                }
              }}
              onError={() => setError('Google sign-in failed')}
              shape="pill"
              text="continue_with"
            />
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-400">
            No account?{' '}
            <Link to="/signup" className="font-bold text-accent-blue hover:text-blue-400 underline">
              Create one
            </Link>
          </p>
        </div>

        {/* Trust Message */}
        <p className="text-center text-xs text-gray-500 mt-6">
          🔒 Your login is secure and encrypted. No spam, ever.
        </p>
      </div>
    </main>
  );
}
