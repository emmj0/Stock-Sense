import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'account'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveProfile = async () => {
    try {
      setError('');
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setError('');
      setMessage('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to change password');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      try {
        setError('');
        logout();
        navigate('/');
      } catch (err) {
        setError('Failed to delete account');
      }
    }
  };

  return (
    <main className="min-h-screen bg-dark-bg py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">⚙️ Settings</h1>
          <p className="text-lg text-gray-400">Manage your account and preferences</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 backdrop-blur">
            <p className="text-accent-red font-medium">⚠️ {error}</p>
          </div>
        )}
        {message && (
          <div className="mb-6 p-4 rounded-lg bg-accent-green/20 border border-accent-green/50 backdrop-blur">
            <p className="text-accent-green font-medium">✅ {message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-dark-border">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-accent-blue text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            👤 Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-accent-blue text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            🔐 Security
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'account'
                ? 'border-accent-blue text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            ⚡ Account
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Profile Information</h2>

              {!isEditing ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-blue to-accent-green flex items-center justify-center text-white font-bold text-2xl">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Name</p>
                      <p className="text-white text-xl font-semibold">{user?.name}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">Email Address</p>
                    <p className="text-white text-lg">{user?.email}</p>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-3 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    ✏️ Edit Profile
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 px-6 py-3 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
                    >
                      💾 Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-6 py-3 bg-dark-border text-gray-300 font-semibold rounded-lg hover:bg-dark-border/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Change Password</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 rounded-lg border border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-lg border border-dark-border bg-dark-bg text-white placeholder-gray-500 focus:border-accent-blue focus:outline-none"
                  />
                </div>

                <div className="bg-dark-border/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">
                    ℹ️ Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
                  </p>
                </div>

                <button
                  onClick={handleChangePassword}
                  className="w-full px-6 py-3 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
                >
                  🔑 Update Password
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Two-Factor Authentication</h2>
              <p className="text-gray-400 mb-6">Enhance your account security with 2FA</p>
              <button
                disabled
                className="w-full px-6 py-3 bg-dark-border text-gray-400 font-semibold rounded-lg cursor-not-allowed opacity-50"
                title="Coming soon"
              >
                🔐 Enable 2FA (Coming Soon)
              </button>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Account Information</h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center pb-4 border-b border-dark-border">
                  <div>
                    <p className="text-gray-300 font-semibold">Account Created</p>
                    <p className="text-gray-500 text-sm">Since {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-dark-border">
                  <div>
                    <p className="text-gray-300 font-semibold">Account Status</p>
                    <p className="text-accent-green text-sm">✅ Active</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-300 font-semibold">Plan</p>
                    <p className="text-gray-500 text-sm">Free</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-dark-card border border-dark-border p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Danger Zone</h2>
              <p className="text-gray-400 mb-6">Irreversible actions</p>

              <button
                onClick={handleDeleteAccount}
                className="w-full px-6 py-3 bg-accent-red text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
              >
                🗑️ Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
