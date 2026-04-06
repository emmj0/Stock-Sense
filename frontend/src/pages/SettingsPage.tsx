import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { fetchUserProgress, fetchCourses, fetchPreferences, savePreferences } from '../api';
import { Toast, ConfirmModal } from '../components/Toast';
import { GraduationCap, CheckCircle2, Clock, Lock, BarChart3, Star, BookOpen, Sliders } from 'lucide-react';
import type { Preferences } from '../types';

interface CourseProgress {
  courseId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  readingCompleted: boolean;
  practiceCompleted: boolean;
  quizScore: number;
  quizPassed: boolean;
  startedAt?: string;
  completedAt?: string;
}

interface Course {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  isUnlocked: boolean;
  progress: CourseProgress;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'learning' | 'security' | 'account'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Learning progress state
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningStats, setLearningStats] = useState({
    currentCourseIndex: 0,
    totalCoursesCompleted: 0,
    totalCourses: 0,
  });
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  // Preferences state
  const [prefs, setPrefs] = useState<Preferences>({
    riskTolerance: 'moderate',
    sectors: ['Technology', 'Energy'],
    investmentHorizon: '1-3 years',
    marketCapFocus: 'Mid-cap',
    dividendPreference: 'Reinvest dividends',
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState('');
  const [prefsError, setPrefsError] = useState('');

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

  useEffect(() => {
    if (activeTab === 'learning') {
      loadLearningProgress();
    } else if (activeTab === 'preferences') {
      loadPreferences();
    }
  }, [activeTab]);

  const loadLearningProgress = async () => {
    setLoadingProgress(true);
    try {
      const data = await fetchCourses();
      setCourses(data.courses || []);
      setLearningStats(data.userStats || {
        currentCourseIndex: 0,
        totalCoursesCompleted: 0,
        totalCourses: 0,
      });
    } catch (err) {
      console.error('Failed to load learning progress:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  const loadPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const data = await fetchPreferences();
      if (data) {
        setPrefs({ ...prefs, ...data });
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const updatePref = (key: keyof Preferences, value: any) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSector = (sector: string) => {
    const current = prefs.sectors || [];
    const updated = current.includes(sector)
      ? current.filter((s) => s !== sector)
      : [...current, sector];
    updatePref('sectors', updated);
  };

  const handleSavePreferences = async () => {
    setLoadingPrefs(true);
    setPrefsError('');
    setPrefsMessage('');
    try {
      await savePreferences(prefs);
      setPrefsMessage('Preferences saved successfully!');
      setTimeout(() => setPrefsMessage(''), 3000);
    } catch (err: any) {
      setPrefsError(err?.response?.data?.message || 'Failed to save preferences');
    } finally {
      setLoadingPrefs(false);
    }
  };

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

  const handleDeleteAccount = () => {
    setConfirmDeleteAccount(true);
  };

  const executeDeleteAccount = () => {
    setConfirmDeleteAccount(false);
    try {
      logout();
      navigate('/');
    } catch {
      setError('Failed to delete account');
    }
  };

  return (
    <main className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div>
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Settings</h1>
          <p className="text-base sm:text-lg text-gray-600">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 sm:gap-4 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'profile'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base flex items-center gap-1 sm:gap-2 ${
              activeTab === 'preferences'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Preferences</span>
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base flex items-center gap-1 sm:gap-2 ${
              activeTab === 'learning'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Learning</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'security'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'account'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Account
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-black mb-6">Profile Information</h2>

              {!isEditing ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg sm:text-2xl flex-shrink-0">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs sm:text-sm">Name</p>
                      <p className="text-black text-lg sm:text-xl font-semibold">{user?.name}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs sm:text-sm mb-2">Email Address</p>
                    <p className="text-black text-base sm:text-lg break-all">{user?.email}</p>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 bg-white text-black text-sm sm:text-base placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 bg-white text-black text-sm sm:text-base placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors text-sm sm:text-base"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 md:p-8 shadow-sm">
              {loadingPrefs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Preferences</h2>
                  <form className="space-y-6">
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
                              onChange={(e) => updatePref('riskTolerance', e.target.value as Preferences['riskTolerance'])}
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
                        onChange={(e) => updatePref('investmentHorizon', e.target.value)}
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
                        onChange={(e) => updatePref('marketCapFocus', e.target.value)}
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
                        onChange={(e) => updatePref('dividendPreference', e.target.value)}
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

                    {/* Error/Success Messages */}
                    {prefsError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                        <p className="text-xs text-red-700 font-medium">{prefsError}</p>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      disabled={loadingPrefs}
                      className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {loadingPrefs ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* Learning Progress Tab */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            {loadingProgress ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <Star className="w-6 h-6" />
                      <span className="text-sm font-medium text-blue-100">Courses Completed</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {learningStats.totalCoursesCompleted} / {learningStats.totalCourses}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 p-4 sm:p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-xs sm:text-sm font-medium text-emerald-100">Progress</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {learningStats.totalCourses > 0 
                        ? Math.round((learningStats.totalCoursesCompleted / learningStats.totalCourses) * 100) 
                        : 0}%
                    </p>
                  </div>

                  <div className="rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-4 sm:p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-xs sm:text-sm font-medium text-purple-100">Current Level</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {learningStats.currentCourseIndex + 1}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Overall Learning Progress</h3>
                  <div className="relative">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${learningStats.totalCourses > 0 
                            ? (learningStats.totalCoursesCompleted / learningStats.totalCourses) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs sm:text-sm text-gray-500">
                      <span>Start</span>
                      <span className="text-center">{learningStats.totalCoursesCompleted} of {learningStats.totalCourses}</span>
                      <span>Expert</span>
                    </div>
                  </div>
                </div>

                {/* Course List with Progress */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Your Courses</h3>
                    <Link 
                      to="/learn"
                      className="text-sm text-brand-500 hover:text-brand-600 font-medium"
                    >
                      Go to Learning →
                    </Link>
                  </div>

                  <div className="space-y-4">
                    {courses.map((course, index) => {
                      const statusColors = {
                        completed: 'bg-green-100 text-green-700 border-green-200',
                        in_progress: 'bg-brand-100 text-brand-600 border-brand-200',
                        not_started: 'bg-gray-100 text-gray-600 border-gray-200',
                      };

                      const difficultyColors = {
                        beginner: 'bg-emerald-50 text-emerald-700',
                        intermediate: 'bg-amber-50 text-amber-700',
                        advanced: 'bg-red-50 text-red-700',
                      };

                      return (
                        <div 
                          key={course.id}
                          className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                            course.isUnlocked
                              ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                              : 'border-gray-100 bg-gray-50 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            {/* Course Number / Status Icon */}
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              course.progress.status === 'completed'
                                ? 'bg-green-100'
                                : course.isUnlocked
                                  ? 'bg-brand-100'
                                  : 'bg-gray-100'
                            }`}>
                              {course.progress.status === 'completed' ? (
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                              ) : course.isUnlocked ? (
                                <span className="text-base sm:text-lg font-bold text-brand-500">{index + 1}</span>
                              ) : (
                                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{course.title}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${difficultyColors[course.difficulty as keyof typeof difficultyColors]}`}>
                                  {course.difficulty}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-500 line-clamp-1">{course.description}</p>

                              {/* Progress Details */}
                              {course.isUnlocked && course.progress.status !== 'not_started' && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${course.progress.readingCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className="text-xs text-gray-500">Reading</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${course.progress.practiceCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className="text-xs text-gray-500">Practice</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${course.progress.quizPassed ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className="text-xs text-gray-500">Quiz</span>
                                  </div>
                                  {course.progress.quizScore > 0 && (
                                    <span className="text-xs font-medium text-brand-500">
                                      {course.progress.quizScore}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Status Badge */}
                            <div className="flex flex-col items-start sm:items-end gap-2">
                              <span className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap ${statusColors[course.progress.status]}`}>
                                {course.progress.status === 'completed' ? 'Completed' 
                                  : course.progress.status === 'in_progress' ? 'In Progress' 
                                  : course.isUnlocked ? 'Not Started' : 'Locked'}
                              </span>
                              {course.progress.completedAt && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(course.progress.completedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {courses.length === 0 && (
                      <div className="text-center py-8">
                        <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No courses available yet</p>
                        <Link 
                          to="/learn"
                          className="inline-block mt-4 px-6 py-2 bg-brand-500 text-white rounded-full font-medium hover:bg-brand-600 transition-colors"
                        >
                          Start Learning
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Achievements / Badges */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Achievements</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl text-center border-2 ${
                      learningStats.totalCoursesCompleted >= 1
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}>
                      <div className="text-3xl mb-2">🎯</div>
                      <p className="text-sm font-medium text-gray-700">First Step</p>
                      <p className="text-xs text-gray-500">Complete 1 course</p>
                    </div>

                    <div className={`p-4 rounded-xl text-center border-2 ${
                      learningStats.totalCoursesCompleted >= 5
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}>
                      <div className="text-3xl mb-2">📚</div>
                      <p className="text-sm font-medium text-gray-700">Learner</p>
                      <p className="text-xs text-gray-500">Complete 5 courses</p>
                    </div>

                    <div className={`p-4 rounded-xl text-center border-2 ${
                      learningStats.totalCoursesCompleted >= 8
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}>
                      <div className="text-3xl mb-2">🌟</div>
                      <p className="text-sm font-medium text-gray-700">Expert</p>
                      <p className="text-xs text-gray-500">Complete 8 courses</p>
                    </div>

                    <div className={`p-4 rounded-xl text-center border-2 ${
                      learningStats.totalCoursesCompleted >= learningStats.totalCourses && learningStats.totalCourses > 0
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}>
                      <div className="text-3xl mb-2">🏆</div>
                      <p className="text-sm font-medium text-gray-700">Master</p>
                      <p className="text-xs text-gray-500">Complete all courses</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-bold text-black mb-6">Change Password</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-black placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                  />
                </div>

                <div className="bg-brand-50 rounded-lg p-4 border border-brand-200">
                  <p className="text-gray-700 text-sm">
                    Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
                  </p>
                </div>

                <button
                  onClick={handleChangePassword}
                  className="w-full px-6 py-3 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Update Password
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <h2 className="text-2xl font-bold text-black mb-4">Two-Factor Authentication</h2>
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
              <h2 className="text-2xl font-bold text-black mb-6">Account Information</h2>

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
              <h2 className="text-2xl font-bold text-black mb-2">Danger Zone</h2>
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
        {error && <Toast message={error} type="error" onClose={() => setError('')} />}
        {message && <Toast message={message} type="success" onClose={() => setMessage('')} />}
        {prefsError && <Toast message={prefsError} type="error" onClose={() => setPrefsError('')} />}
        {prefsMessage && <Toast message={prefsMessage} type="success" onClose={() => setPrefsMessage('')} />}
        {confirmDeleteAccount && (
          <ConfirmModal
            title="Delete Account"
            message="Are you sure you want to delete your account? This action cannot be undone."
            confirmLabel="Delete Account"
            destructive
            onConfirm={executeDeleteAccount}
            onCancel={() => setConfirmDeleteAccount(false)}
          />
        )}
      </div>
    </main>
  );
}
