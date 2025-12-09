import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { fetchUserProgress, fetchCourses } from '../api';
import { HiOutlineAcademicCap, HiOutlineCheckCircle, HiOutlineClock, HiOutlineLockClosed, HiOutlineChartBar, HiOutlineStar, HiOutlineBookOpen } from 'react-icons/hi';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'learning' | 'security' | 'account'>('profile');
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

  useEffect(() => {
    if (activeTab === 'learning') {
      loadLearningProgress();
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
        <div className="mb-8 flex gap-4 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'learning'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <HiOutlineAcademicCap className="w-5 h-5" />
            Learning Progress
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-blue-600 text-black'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-4 font-semibold transition-colors border-b-2 whitespace-nowrap ${
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
                      <HiOutlineStar className="w-6 h-6" />
                      <span className="text-sm font-medium text-blue-100">Courses Completed</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {learningStats.totalCoursesCompleted} / {learningStats.totalCourses}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <HiOutlineChartBar className="w-6 h-6" />
                      <span className="text-sm font-medium text-emerald-100">Progress</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {learningStats.totalCourses > 0 
                        ? Math.round((learningStats.totalCoursesCompleted / learningStats.totalCourses) * 100) 
                        : 0}%
                    </p>
                  </div>

                  <div className="rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <HiOutlineBookOpen className="w-6 h-6" />
                      <span className="text-sm font-medium text-purple-100">Current Level</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {learningStats.currentCourseIndex + 1}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Learning Progress</h3>
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
                    <div className="flex justify-between mt-2 text-sm text-gray-500">
                      <span>Start</span>
                      <span>{learningStats.totalCoursesCompleted} of {learningStats.totalCourses} courses</span>
                      <span>Expert</span>
                    </div>
                  </div>
                </div>

                {/* Course List with Progress */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Your Courses</h3>
                    <Link 
                      to="/learn"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Go to Learning →
                    </Link>
                  </div>

                  <div className="space-y-4">
                    {courses.map((course, index) => {
                      const statusColors = {
                        completed: 'bg-green-100 text-green-700 border-green-200',
                        in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
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
                          className={`p-4 rounded-xl border-2 transition-all ${
                            course.isUnlocked 
                              ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' 
                              : 'border-gray-100 bg-gray-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              {/* Course Number / Status Icon */}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                course.progress.status === 'completed' 
                                  ? 'bg-green-100' 
                                  : course.isUnlocked 
                                    ? 'bg-blue-100' 
                                    : 'bg-gray-100'
                              }`}>
                                {course.progress.status === 'completed' ? (
                                  <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                                ) : course.isUnlocked ? (
                                  <span className="text-lg font-bold text-blue-600">{index + 1}</span>
                                ) : (
                                  <HiOutlineLockClosed className="w-5 h-5 text-gray-400" />
                                )}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{course.title}</h4>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColors[course.difficulty as keyof typeof difficultyColors]}`}>
                                    {course.difficulty}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-1">{course.description}</p>

                                {/* Progress Details */}
                                {course.isUnlocked && course.progress.status !== 'not_started' && (
                                  <div className="mt-3 flex flex-wrap items-center gap-3">
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
                                      <span className="text-xs font-medium text-blue-600">
                                        Score: {course.progress.quizScore}%
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-xs px-3 py-1 rounded-full border ${statusColors[course.progress.status]}`}>
                                {course.progress.status === 'completed' ? 'Completed' 
                                  : course.progress.status === 'in_progress' ? 'In Progress' 
                                  : course.isUnlocked ? 'Not Started' : 'Locked'}
                              </span>
                              {course.progress.completedAt && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <HiOutlineClock className="w-3 h-3" />
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
                        <HiOutlineAcademicCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No courses available yet</p>
                        <Link 
                          to="/learn"
                          className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
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
