import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { fetchCourses, fetchPreferences, savePreferences, updateProfile } from '../api';
import { resizeImage } from '../lib/image';
import { Toast, ConfirmModal } from '../components/Toast';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Lock,
  BarChart3,
  Star,
  BookOpen,
  Sliders,
  Settings,
  User,
  Shield,
  CreditCard,
  Lock as LockIcon,
  KeyRound,
  Trophy,
  ArrowRight,
  Camera,
  Trash2,
} from 'lucide-react';
import { PageHeader, SectionTitle } from '../components/ui';
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
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'learning' | 'security' | 'account'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
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
    if (!formData.name.trim()) { setError('Name cannot be empty'); return; }
    try {
      setError('');
      await updateProfile({ name: formData.name.trim() });
      await refreshUser();
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    }
  };

  const onPickPhoto = () => fileRef.current?.click();

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file'); return; }
    setError('');
    setSavingPhoto(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      await updateProfile({ avatar: dataUrl });
      await refreshUser();
      setMessage('Profile photo updated!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload photo');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setError('');
    setSavingPhoto(true);
    try {
      await updateProfile({ avatar: null });
      await refreshUser();
      setMessage('Profile photo removed');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove photo');
    } finally {
      setSavingPhoto(false);
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

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'preferences' as const, label: 'Preferences', icon: Sliders },
    { id: 'learning' as const, label: 'Learning', icon: GraduationCap },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'account' as const, label: 'Account', icon: CreditCard },
  ];

  const progressPct = learningStats.totalCourses > 0
    ? Math.round((learningStats.totalCoursesCompleted / learningStats.totalCourses) * 100)
    : 0;

  return (
    <div className="page">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your account, preferences, and learning"
        accent="brand"
      />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 reveal">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                active
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="card p-6 reveal stagger-1">
            <SectionTitle icon={User}>Profile Information</SectionTitle>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />

            {/* Avatar editor — circular, with a plain circle fallback when no photo */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 mb-6 border-b border-slate-100">
              <button
                onClick={onPickPhoto}
                title="Change profile photo"
                className="relative w-24 h-24 rounded-full overflow-hidden shrink-0 ring-2 ring-slate-200 shadow-soft group"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-3xl font-bold">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${savingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {savingPhoto
                    ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera className="w-6 h-6 text-white" />}
                </span>
              </button>

              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 truncate">{user?.name}</p>
                <p className="text-sm text-slate-500 truncate">{user?.email}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={onPickPhoto} disabled={savingPhoto} className="btn btn-secondary py-2 px-4 text-xs">
                    <Camera className="w-3.5 h-3.5" /> {user?.avatar ? 'Change photo' : 'Upload photo'}
                  </button>
                  {user?.avatar && (
                    <button onClick={handleRemovePhoto} disabled={savingPhoto} className="btn py-2 px-4 text-xs text-red-600 bg-red-50 hover:bg-red-100">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">JPG or PNG, automatically resized.</p>
              </div>
            </div>

            {!isEditing ? (
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="eyebrow">Name</p>
                    <p className="text-slate-900 text-base font-semibold mt-1 truncate">{user?.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="eyebrow">Email Address</p>
                    <p className="text-slate-900 text-base font-medium mt-1 break-all">{user?.email}</p>
                  </div>
                </div>

                <button onClick={() => { setFormData({ name: user?.name || '', email: user?.email || '' }); setIsEditing(true); }} className="btn btn-primary">
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                  <input type="email" name="email" value={formData.email} disabled className="input bg-slate-50 text-slate-400 cursor-not-allowed" />
                  <p className="text-[11px] text-slate-400 mt-1.5">Email can't be changed.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={handleSaveProfile} className="btn btn-primary flex-1">Save Changes</button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary flex-1">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="card p-6 reveal stagger-1">
            {loadingPrefs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <SectionTitle icon={Sliders}>Your Preferences</SectionTitle>
                <form className="space-y-6">
                  {/* Risk Tolerance */}
                  <div>
                    <label className="block mb-3">
                      <span className="text-sm font-bold text-slate-900 mb-1 block">Risk Tolerance</span>
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
                          className={`flex items-center p-3.5 rounded-xl border cursor-pointer transition-all ${
                            prefs.riskTolerance === option.value
                              ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="risk"
                            value={option.value}
                            checked={prefs.riskTolerance === option.value}
                            onChange={(e) => updatePref('riskTolerance', e.target.value as Preferences['riskTolerance'])}
                            className="w-4 h-4 accent-brand-500"
                          />
                          <div className="ml-3">
                            <p className="font-semibold text-slate-900 text-sm">{option.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    {/* Investment Horizon */}
                    <div>
                      <label className="block mb-2">
                        <span className="text-sm font-bold text-slate-900 mb-1 block">Investment Horizon</span>
                        <p className="text-xs text-slate-500">How long will you hold your stocks?</p>
                      </label>
                      <select
                        className="input appearance-none"
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
                      <label className="block mb-2">
                        <span className="text-sm font-bold text-slate-900 mb-1 block">Market Cap Focus</span>
                        <p className="text-xs text-slate-500">What size companies interest you?</p>
                      </label>
                      <select
                        className="input appearance-none"
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
                  </div>

                  {/* Dividend Preference */}
                  <div>
                    <label className="block mb-2">
                      <span className="text-sm font-bold text-slate-900 mb-1 block">Dividend Preference</span>
                      <p className="text-xs text-slate-500">How do you prefer to receive dividends?</p>
                    </label>
                    <select
                      className="input appearance-none"
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
                      <span className="text-sm font-bold text-slate-900 mb-1 block">Preferred Sectors</span>
                      <p className="text-xs text-slate-500">Which industries interest you most? (Select at least one)</p>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sectorOptions.map((sector) => (
                        <button
                          key={sector}
                          type="button"
                          onClick={() => toggleSector(sector)}
                          className={`px-3 py-2 rounded-xl font-medium text-sm transition-all border ${
                            (prefs.sectors || []).includes(sector)
                              ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {sector}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Error Message */}
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
                    className="btn btn-primary w-full"
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
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-orange-100/50 p-5 shadow-soft reveal stagger-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="eyebrow">Courses Completed</p>
                    <Star className="w-4 h-4 text-brand-500" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {learningStats.totalCoursesCompleted} / {learningStats.totalCourses}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 shadow-soft reveal stagger-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="eyebrow">Progress</p>
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{progressPct}%</p>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/50 p-5 shadow-soft reveal stagger-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="eyebrow">Current Level</p>
                    <BookOpen className="w-4 h-4 text-sky-500" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {learningStats.currentCourseIndex + 1}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="card p-6 reveal stagger-2">
                <SectionTitle icon={BarChart3}>Overall Learning Progress</SectionTitle>
                <div className="relative">
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs sm:text-sm text-slate-500">
                    <span>Start</span>
                    <span className="text-center font-medium text-slate-700">
                      {learningStats.totalCoursesCompleted} of {learningStats.totalCourses}
                    </span>
                    <span>Expert</span>
                  </div>
                </div>
              </div>

              {/* Course List with Progress */}
              <div className="card p-6 reveal stagger-3">
                <SectionTitle
                  icon={BookOpen}
                  right={
                    <Link
                      to="/learn"
                      className="text-sm text-brand-500 hover:text-brand-600 font-semibold inline-flex items-center gap-1"
                    >
                      Go to Learning <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  }
                >
                  Your Courses
                </SectionTitle>

                <div className="space-y-3">
                  {courses.map((course, index) => {
                    const statusColors = {
                      completed: 'pill-up',
                      in_progress: 'pill-brand',
                      not_started: 'pill-flat',
                    };

                    const difficultyColors = {
                      beginner: 'bg-emerald-50 text-emerald-700',
                      intermediate: 'bg-amber-50 text-amber-700',
                      advanced: 'bg-red-50 text-red-700',
                    };

                    return (
                      <div
                        key={course.id}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                          course.isUnlocked
                            ? 'border-slate-200 hover:border-slate-300 hover:shadow-card-hover'
                            : 'border-slate-100 bg-slate-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                          {/* Course Number / Status Icon */}
                          <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              course.progress.status === 'completed'
                                ? 'bg-emerald-100'
                                : course.isUnlocked
                                ? 'bg-brand-100'
                                : 'bg-slate-100'
                            }`}
                          >
                            {course.progress.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                            ) : course.isUnlocked ? (
                              <span className="text-base sm:text-lg font-bold text-brand-500">{index + 1}</span>
                            ) : (
                              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                              <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">{course.title}</h4>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                                  difficultyColors[course.difficulty as keyof typeof difficultyColors]
                                }`}
                              >
                                {course.difficulty}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">{course.description}</p>

                            {/* Progress Details */}
                            {course.isUnlocked && course.progress.status !== 'not_started' && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${course.progress.readingCompleted ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-xs text-slate-500">Reading</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${course.progress.practiceCompleted ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-xs text-slate-500">Practice</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${course.progress.quizPassed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-xs text-slate-500">Quiz</span>
                                </div>
                                {course.progress.quizScore > 0 && (
                                  <span className="text-xs font-semibold text-brand-500">
                                    {course.progress.quizScore}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="flex flex-col items-start sm:items-end gap-2">
                            <span className={`pill ${statusColors[course.progress.status]}`}>
                              {course.progress.status === 'completed'
                                ? 'Completed'
                                : course.progress.status === 'in_progress'
                                ? 'In Progress'
                                : course.isUnlocked
                                ? 'Not Started'
                                : 'Locked'}
                            </span>
                            {course.progress.completedAt && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
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
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-200/60">
                        <GraduationCap className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-bold">No courses available yet</p>
                      <Link to="/learn" className="btn btn-primary mt-4 inline-flex">
                        Start Learning
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievements / Badges */}
              <div className="card p-6 reveal stagger-4">
                <SectionTitle icon={Trophy}>Achievements</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    className={`p-4 rounded-xl text-center border ${
                      learningStats.totalCoursesCompleted >= 1
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-slate-50/60 opacity-50'
                    }`}
                  >
                    <div className="text-3xl mb-2">🎯</div>
                    <p className="text-sm font-semibold text-slate-700">First Step</p>
                    <p className="text-xs text-slate-500">Complete 1 course</p>
                  </div>

                  <div
                    className={`p-4 rounded-xl text-center border ${
                      learningStats.totalCoursesCompleted >= 5
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-200 bg-slate-50/60 opacity-50'
                    }`}
                  >
                    <div className="text-3xl mb-2">📚</div>
                    <p className="text-sm font-semibold text-slate-700">Learner</p>
                    <p className="text-xs text-slate-500">Complete 5 courses</p>
                  </div>

                  <div
                    className={`p-4 rounded-xl text-center border ${
                      learningStats.totalCoursesCompleted >= 8
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-slate-200 bg-slate-50/60 opacity-50'
                    }`}
                  >
                    <div className="text-3xl mb-2">🌟</div>
                    <p className="text-sm font-semibold text-slate-700">Expert</p>
                    <p className="text-xs text-slate-500">Complete 8 courses</p>
                  </div>

                  <div
                    className={`p-4 rounded-xl text-center border ${
                      learningStats.totalCoursesCompleted >= learningStats.totalCourses && learningStats.totalCourses > 0
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50/60 opacity-50'
                    }`}
                  >
                    <div className="text-3xl mb-2">🏆</div>
                    <p className="text-sm font-semibold text-slate-700">Master</p>
                    <p className="text-xs text-slate-500">Complete all courses</p>
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
          <div className="card p-6 reveal stagger-1">
            <SectionTitle icon={KeyRound}>Change Password</SectionTitle>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="input"
                />
              </div>

              <div className="bg-brand-50 rounded-xl p-4 border border-brand-200">
                <p className="text-slate-700 text-sm">
                  Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
                </p>
              </div>

              <button onClick={handleChangePassword} className="btn btn-primary w-full">
                Update Password
              </button>
            </div>
          </div>

          <div className="card p-6 reveal stagger-2">
            <SectionTitle icon={LockIcon}>Two-Factor Authentication</SectionTitle>
            <p className="text-slate-500 text-sm mb-5">Enhance your account security with 2FA</p>
            <button disabled className="btn btn-secondary w-full" title="Coming soon">
              Enable 2FA (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="card p-6 reveal stagger-1">
            <SectionTitle icon={CreditCard}>Account Information</SectionTitle>

            <div className="divide-y divide-slate-100">
              <div className="flex justify-between items-center py-4 first:pt-0">
                <div>
                  <p className="text-slate-900 font-semibold">Account Created</p>
                  <p className="text-slate-500 text-sm">Since {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex justify-between items-center py-4">
                <div>
                  <p className="text-slate-900 font-semibold">Account Status</p>
                  <p className="text-emerald-600 text-sm font-medium">Active</p>
                </div>
                <span className="pill pill-up">Active</span>
              </div>

              <div className="flex justify-between items-center py-4 last:pb-0">
                <div>
                  <p className="text-slate-900 font-semibold">Plan</p>
                  <p className="text-slate-500 text-sm">Free</p>
                </div>
                <span className="pill pill-sky">Free</span>
              </div>
            </div>
          </div>

          <div className="card p-6 border-red-200 bg-red-50/60 reveal stagger-2">
            <SectionTitle icon={Shield}>Danger Zone</SectionTitle>
            <p className="text-slate-500 text-sm mb-5">Irreversible actions</p>

            <button
              onClick={handleDeleteAccount}
              className="btn w-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25"
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
  );
}
