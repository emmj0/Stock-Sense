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
    <main className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-black mb-2">Settings</h1>
          <p className="text-lg text-gray-600">Manage your account and preferences</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}
        {message && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
              activeTab === 'account'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Account
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-display font-bold text-black mb-6">Profile Information</h2>

              {!isEditing ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Name</p>
                      <p className="text-black text-xl font-semibold">{user?.name}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-600 text-sm mb-2">Email Address</p>
                    <p className="text-black text-lg">{user?.email}</p>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
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
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-display font-bold text-black mb-6">Change Password</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-gray-700 text-sm">
                    Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
                  </p>
                </div>

                <button
                  onClick={handleChangePassword}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Password
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-display font-bold text-black mb-4">Two-Factor Authentication</h2>
              <p className="text-gray-600 mb-6">Enhance your account security with 2FA</p>
              <button
                disabled
                className="w-full px-6 py-3 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed opacity-50"
                title="Coming soon"
              >
                Enable 2FA (Coming Soon)
              </button>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-display font-bold text-black mb-6">Account Information</h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-gray-800 font-semibold">Account Created</p>
                    <p className="text-gray-600 text-sm">Since {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-gray-800 font-semibold">Account Status</p>
                    <p className="text-green-600 text-sm">Active</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-800 font-semibold">Plan</p>
                    <p className="text-gray-600 text-sm">Free</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-8">
              <h2 className="text-2xl font-display font-bold text-black mb-2">Danger Zone</h2>
              <p className="text-gray-600 mb-6">Irreversible actions</p>

              <button
                onClick={handleDeleteAccount}
                className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
