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
    <main className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-black mb-2">Welcome Back</h1>
          <p className="text-gray-600 text-lg">Sign in to manage your PSX portfolio</p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl bg-white border border-gray-200 p-8 shadow-sm">
          {/* Email/Password Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email Address
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Password
              </label>
              <input
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm text-gray-500 font-medium">or</span>
            <div className="h-px flex-1 bg-gray-200" />
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
          <p className="mt-6 text-center text-sm text-gray-600">
            No account?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Create one
            </Link>
          </p>
        </div>

        {/* Trust Message */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Your login is secure and encrypted. No spam, ever.
        </p>
      </div>
    </main>
  );
}
