import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../providers/AuthProvider';

export default function SignupPage() {
  const { register, authenticateWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/preferences');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      await authenticateWithGoogle(credential);
      navigate('/preferences');
    } catch (err: any) {
      setError('Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-black mb-2">Get Started</h1>
          <p className="text-gray-600 text-lg">Create your StockSense account in seconds</p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl bg-white border border-gray-200 p-8 shadow-sm">
          {/* Email/Password Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Full Name
              </label>
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Must be at least 8 characters. Use a mix of letters, numbers, and symbols.
              </p>
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
              {loading ? 'Creating account...' : 'Create Account'}
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
              onError={() => setError('Google sign-up failed')}
              shape="pill"
              text="signup_with"
            />
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>

        {/* Trust Message */}
        <p className="text-center text-xs text-gray-500 mt-6">
          We respect your privacy. Your data is secure and encrypted.
        </p>
      </div>
    </main>
  );
}
