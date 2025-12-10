import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCourses, fetchCourse, startCourse, markReadingComplete, markPracticeComplete, submitQuiz } from '../api';
import { Loader, SkeletonLoader } from '../components/Loader';
import { 
  HiOutlineLockClosed, 
  HiOutlineCheckCircle, 
  HiOutlineBookOpen, 
  HiOutlineAcademicCap,
  HiOutlineClipboardCheck,
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiOutlineRefresh,
  HiOutlineLightningBolt,
  HiOutlineStar,
  HiOutlineX
} from 'react-icons/hi';

interface CourseOverview {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  order: number;
  quizCount: number;
  isUnlocked: boolean;
  progress: {
    status: string;
    readingCompleted: boolean;
    practiceCompleted: boolean;
    quizScore: number;
    quizPassed: boolean;
    startedAt?: string;
    completedAt?: string;
  };
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
}

interface CourseDetail {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  content: {
    readingMaterial: string;
    practiceQuestions: string[];
  };
  quizzes: Quiz[];
  order: number;
}

interface QuizResult {
  quizId: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function LearnPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [userStats, setUserStats] = useState<{ currentCourseIndex: number; totalCoursesCompleted: number; totalCourses: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'reading' | 'practice' | 'quiz'>('reading');
  const [quizAnswers, setQuizAnswers] = useState<{ [quizId: string]: string }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState<{ score: number; passed: boolean; results: QuizResult[] } | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await fetchCourses();
      setCourses(data.courses);
      setUserStats(data.userStats);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCourse = async (courseId: string) => {
    setCourseLoading(true);
    setQuizSubmitted(false);
    setQuizResults(null);
    setQuizAnswers({});
    setActiveTab('reading');
    
    try {
      const data = await fetchCourse(courseId);
      setSelectedCourse(data.course);
      setCourseProgress(data.progress);
      
      // Start course if not started
      if (data.progress.status === 'not_started') {
        await startCourse(courseId);
      }
    } catch (err: any) {
      console.error('Failed to open course:', err);
      if (err.response?.status === 403) {
        alert('This course is locked. Complete previous courses first.');
      }
    } finally {
      setCourseLoading(false);
    }
  };

  const closeCourse = () => {
    setSelectedCourse(null);
    setCourseProgress(null);
    setQuizSubmitted(false);
    setQuizResults(null);
    setQuizAnswers({});
    loadCourses(); // Refresh course list
  };

  const handleMarkReadingComplete = async () => {
    if (!selectedCourse) return;
    try {
      await markReadingComplete(selectedCourse.id);
      setCourseProgress((prev: any) => ({ ...prev, readingCompleted: true }));
    } catch (err) {
      console.error('Failed to mark reading complete:', err);
    }
  };

  const handleMarkPracticeComplete = async () => {
    if (!selectedCourse) return;
    try {
      await markPracticeComplete(selectedCourse.id);
      setCourseProgress((prev: any) => ({ ...prev, practiceCompleted: true }));
    } catch (err) {
      console.error('Failed to mark practice complete:', err);
    }
  };

  const handleQuizSubmit = async () => {
    if (!selectedCourse) return;
    
    // Check if all questions are answered
    const unanswered = selectedCourse.quizzes.filter(q => !quizAnswers[q.id]);
    if (unanswered.length > 0) {
      alert('Please answer all questions before submitting.');
      return;
    }

    setSubmittingQuiz(true);
    try {
      const answers = Object.entries(quizAnswers).map(([quizId, selectedAnswer]) => ({
        quizId,
        selectedAnswer,
      }));

      const result = await submitQuiz(selectedCourse.id, answers);
      setQuizResults({
        score: result.quizScore,
        passed: result.quizPassed,
        results: result.results,
      });
      setQuizSubmitted(true);
      setCourseProgress(result.progress);
      
      // Refresh courses if passed
      if (result.quizPassed) {
        loadCourses();
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const retryQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResults(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (course: CourseOverview) => {
    if (!course.isUnlocked) {
      return <HiOutlineLockClosed className="w-6 h-6 text-gray-400" />;
    }
    if (course.progress.status === 'completed') {
      return <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />;
    }
    if (course.progress.status === 'in_progress') {
      return <HiOutlineLightningBolt className="w-6 h-6 text-blue-500" />;
    }
    return <HiOutlineBookOpen className="w-6 h-6 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader text="Loading courses..." />
      </div>
    );
  }

  // Course Detail View
  if (selectedCourse) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Course Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={closeCourse}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <HiOutlineArrowLeft className="w-5 h-5" />
                Back to Courses
              </button>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getDifficultyColor(selectedCourse.difficulty)}`}>
                {selectedCourse.difficulty}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">{selectedCourse.title}</h1>
            <p className="text-gray-600 mt-1">{selectedCourse.description}</p>

            {/* Progress Tabs */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setActiveTab('reading')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'reading' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <HiOutlineBookOpen className="w-4 h-4" />
                Reading
                {courseProgress?.readingCompleted && <HiOutlineCheckCircle className="w-4 h-4 text-green-300" />}
              </button>
              <button
                onClick={() => setActiveTab('practice')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'practice' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <HiOutlineClipboardCheck className="w-4 h-4" />
                Practice
                {courseProgress?.practiceCompleted && <HiOutlineCheckCircle className="w-4 h-4 text-green-300" />}
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'quiz' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <HiOutlineAcademicCap className="w-4 h-4" />
                Quiz ({selectedCourse.quizzes.length})
                {courseProgress?.quizPassed && <HiOutlineCheckCircle className="w-4 h-4 text-green-300" />}
              </button>
            </div>
          </div>
        </div>

        {/* Course Content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {courseLoading ? (
            <Loader text="Loading course..." />
          ) : (
            <>
              {/* Reading Tab */}
              {activeTab === 'reading' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                  <div className="prose prose-blue max-w-none">
                    {selectedCourse.content.readingMaterial.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-4">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  
                  {!courseProgress?.readingCompleted && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <button
                        onClick={handleMarkReadingComplete}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                      >
                        <HiOutlineCheckCircle className="w-5 h-5" />
                        Mark as Read
                      </button>
                    </div>
                  )}
                  
                  {courseProgress?.readingCompleted && (
                    <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-green-600 font-medium">
                        <HiOutlineCheckCircle className="w-5 h-5" />
                        Reading Completed
                      </span>
                      <button
                        onClick={() => setActiveTab('practice')}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                      >
                        Continue to Practice
                        <HiOutlineArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Practice Tab */}
              {activeTab === 'practice' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Practice Questions</h2>
                  <p className="text-gray-600 mb-6">Think about these questions to reinforce your learning:</p>
                  
                  <div className="space-y-4">
                    {selectedCourse.content.practiceQuestions.map((question, idx) => (
                      <div key={idx} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {idx + 1}
                          </span>
                          <p className="text-gray-800 font-medium">{question}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!courseProgress?.practiceCompleted && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <button
                        onClick={handleMarkPracticeComplete}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                      >
                        <HiOutlineCheckCircle className="w-5 h-5" />
                        I've Reviewed These Questions
                      </button>
                    </div>
                  )}

                  {courseProgress?.practiceCompleted && (
                    <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-green-600 font-medium">
                        <HiOutlineCheckCircle className="w-5 h-5" />
                        Practice Completed
                      </span>
                      <button
                        onClick={() => setActiveTab('quiz')}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                      >
                        Take the Quiz
                        <HiOutlineArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Tab */}
              {activeTab === 'quiz' && (
                <div className="space-y-6">
                  {!quizSubmitted ? (
                    <>
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-blue-800 font-medium">
                          Answer all {selectedCourse.quizzes.length} questions. You need 60% or higher to pass and unlock the next course.
                        </p>
                      </div>

                      {selectedCourse.quizzes.map((quiz, idx) => (
                        <div key={quiz.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                          <div className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">{quiz.question}</h3>
                              <div className="space-y-3">
                                {quiz.options.map((option, optIdx) => (
                                  <label
                                    key={optIdx}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      quizAnswers[quiz.id] === option
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={quiz.id}
                                      value={option}
                                      checked={quizAnswers[quiz.id] === option}
                                      onChange={() => setQuizAnswers(prev => ({ ...prev, [quiz.id]: option }))}
                                      className="w-5 h-5 text-blue-600"
                                    />
                                    <span className="text-gray-800">{option}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end">
                        <button
                          onClick={handleQuizSubmit}
                          disabled={submittingQuiz}
                          className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
                        >
                          {submittingQuiz ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <HiOutlineAcademicCap className="w-5 h-5" />
                              Submit Quiz
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Quiz Results */
                    <div className="space-y-6">
                      {/* Score Card */}
                      <div className={`rounded-2xl p-8 text-center ${quizResults?.passed ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${quizResults?.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                          {quizResults?.passed ? (
                            <HiOutlineStar className="w-10 h-10 text-green-600" />
                          ) : (
                            <HiOutlineX className="w-10 h-10 text-red-600" />
                          )}
                        </div>
                        <h2 className={`text-3xl font-bold mb-2 ${quizResults?.passed ? 'text-green-700' : 'text-red-700'}`}>
                          {quizResults?.score}%
                        </h2>
                        <p className={`text-lg font-medium ${quizResults?.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {quizResults?.passed ? '🎉 Congratulations! You passed!' : 'Keep learning and try again!'}
                        </p>
                        {quizResults?.passed && (
                          <p className="text-green-600 mt-2">Next course has been unlocked!</p>
                        )}
                      </div>

                      {/* Detailed Results */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Your Answers</h3>
                        <div className="space-y-4">
                          {quizResults?.results.map((result, idx) => (
                            <div
                              key={result.quizId}
                              className={`p-4 rounded-xl border-2 ${result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${result.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                  {result.isCorrect ? '✓' : '✗'}
                                </span>
                                <div>
                                  <p className="font-medium text-gray-900">{result.question}</p>
                                  <p className="text-sm mt-2">
                                    <span className="text-gray-500">Your answer: </span>
                                    <span className={result.isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                                      {result.selectedAnswer}
                                    </span>
                                  </p>
                                  {!result.isCorrect && (
                                    <p className="text-sm">
                                      <span className="text-gray-500">Correct answer: </span>
                                      <span className="text-green-700 font-medium">{result.correctAnswer}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-center gap-4">
                        {!quizResults?.passed && (
                          <button
                            onClick={retryQuiz}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                          >
                            <HiOutlineRefresh className="w-5 h-5" />
                            Try Again
                          </button>
                        )}
                        <button
                          onClick={closeCourse}
                          className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                        >
                          Back to Courses
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Course List View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Learn Stocks</h1>
              <p className="mt-2 text-gray-600">Master the Pakistan Stock Market step by step</p>
            </div>
            <button
              onClick={loadCourses}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <HiOutlineRefresh className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* User Progress */}
          {userStats && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
                <p className="text-sm text-blue-100">Courses Completed</p>
                <p className="text-3xl font-bold mt-1">{userStats.totalCoursesCompleted} / {userStats.totalCourses}</p>
                <div className="mt-3 h-2 bg-blue-400/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${(userStats.totalCoursesCompleted / userStats.totalCourses) * 100}%` }}
                  />
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-5 text-white">
                <p className="text-sm text-green-100">Current Level</p>
                <p className="text-3xl font-bold mt-1">
                  {userStats.totalCoursesCompleted === 0 ? 'Beginner' : 
                   userStats.totalCoursesCompleted < 5 ? 'Learner' :
                   userStats.totalCoursesCompleted < 8 ? 'Intermediate' : 'Advanced'}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
                <p className="text-sm text-purple-100">Next Course</p>
                <p className="text-xl font-bold mt-1 truncate">
                  {courses[userStats.currentCourseIndex]?.title || 'All Complete! 🎉'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Course List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {courses.map((course, index) => (
            <div
              key={course.id}
              className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 ${
                course.isUnlocked 
                  ? 'border-gray-200 hover:border-blue-300 hover:shadow-lg cursor-pointer' 
                  : 'border-gray-100 opacity-75'
              }`}
              onClick={() => course.isUnlocked && openCourse(course.id)}
            >
              <div className="p-6 flex items-center gap-6">
                {/* Course Number / Status */}
                <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center ${
                  course.progress.status === 'completed' ? 'bg-green-100' :
                  course.isUnlocked ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {course.progress.status === 'completed' ? (
                    <HiOutlineCheckCircle className="w-8 h-8 text-green-600" />
                  ) : course.isUnlocked ? (
                    <span className="text-2xl font-bold text-blue-600">{index + 1}</span>
                  ) : (
                    <HiOutlineLockClosed className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                {/* Course Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`text-lg font-semibold ${course.isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                      {course.title}
                    </h3>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getDifficultyColor(course.difficulty)}`}>
                      {course.difficulty}
                    </span>
                  </div>
                  <p className={`text-sm ${course.isUnlocked ? 'text-gray-600' : 'text-gray-400'} line-clamp-2`}>
                    {course.description}
                  </p>
                  
                  {/* Progress Indicators */}
                  {course.isUnlocked && course.progress.status !== 'not_started' && (
                    <div className="flex items-center gap-4 mt-3">
                      <span className={`flex items-center gap-1 text-xs ${course.progress.readingCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        <HiOutlineBookOpen className="w-4 h-4" />
                        Reading
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${course.progress.practiceCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        <HiOutlineClipboardCheck className="w-4 h-4" />
                        Practice
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${course.progress.quizPassed ? 'text-green-600' : 'text-gray-400'}`}>
                        <HiOutlineAcademicCap className="w-4 h-4" />
                        Quiz {course.progress.quizPassed && `(${course.progress.quizScore}%)`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  {course.isUnlocked ? (
                    <div className="flex items-center gap-2 text-blue-600">
                      {course.progress.status === 'completed' ? (
                        <span className="text-sm font-medium text-green-600">Completed</span>
                      ) : course.progress.status === 'in_progress' ? (
                        <span className="text-sm font-medium">Continue</span>
                      ) : (
                        <span className="text-sm font-medium">Start</span>
                      )}
                      <HiOutlineArrowRight className="w-5 h-5" />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Locked</span>
                  )}
                </div>
              </div>

              {/* Progress Bar for in-progress courses */}
              {course.isUnlocked && course.progress.status === 'in_progress' && (
                <div className="h-1 bg-gray-100">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ 
                      width: `${
                        ((course.progress.readingCompleted ? 1 : 0) + 
                         (course.progress.practiceCompleted ? 1 : 0) + 
                         (course.progress.quizPassed ? 1 : 0)) / 3 * 100
                      }%` 
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {courses.length === 0 && (
          <div className="text-center py-16">
            <HiOutlineAcademicCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No courses available</h3>
            <p className="text-gray-500 mt-1">Check back later for new content</p>
          </div>
        )}
      </div>
    </div>
  );
}
