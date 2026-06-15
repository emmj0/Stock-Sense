import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCourses, fetchCourse, startCourse, markReadingComplete, markPracticeComplete, submitQuiz, markVideoWatched, fetchNotes, saveNotes } from '../api';
import { Loader } from '../components/Loader';
import { PageHeader } from '../components/ui';
import {
  Lock, CheckCircle2, BookOpen, GraduationCap, ClipboardCheck, ArrowRight, ArrowLeft,
  RefreshCw, Zap, Star, X, Trophy, Sparkles, PlayCircle, Film, ExternalLink, NotebookPen, Check,
} from 'lucide-react';

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

interface Quiz { id: string; question: string; options: string[]; }
interface CourseVideo { title: string; channel?: string; youtubeId?: string; query?: string; description?: string; }

interface CourseDetail {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  content: { readingMaterial: string; practiceQuestions: string[]; videos?: CourseVideo[]; };
  quizzes: Quiz[];
  order: number;
}

// stable key used for "watched" tracking — matches the backend (youtubeId || query)
const videoKey = (v: CourseVideo) => v.youtubeId || v.query || v.title;
const ytSearchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

interface QuizResult {
  quizId: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function LearnPage() {
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [userStats, setUserStats] = useState<{ currentCourseIndex: number; totalCoursesCompleted: number; totalCourses: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'reading' | 'videos' | 'practice' | 'quiz'>('reading');
  const [quizAnswers, setQuizAnswers] = useState<{ [quizId: string]: string }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState<{ score: number; passed: boolean; results: QuizResult[] } | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  // notes
  const [notes, setNotes] = useState('');
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notesOpen, setNotesOpen] = useState(true);
  const notesLoadedFor = useRef<string | null>(null);
  const lastSavedRef = useRef('');

  useEffect(() => { loadCourses(); }, []);

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
    notesLoadedFor.current = null;
    setNotes(''); setNotesStatus('idle');
    try {
      const data = await fetchCourse(courseId);
      setSelectedCourse(data.course);
      setCourseProgress(data.progress);
      if (data.progress.status === 'not_started') await startCourse(courseId);
      try {
        const note = await fetchNotes(courseId);
        setNotes(note.content);
        lastSavedRef.current = note.content;
        notesLoadedFor.current = courseId;
      } catch { notesLoadedFor.current = courseId; }
    } catch (err: any) {
      console.error('Failed to open course:', err);
      if (err.response?.status === 403) alert('This course is locked. Complete previous courses first.');
    } finally {
      setCourseLoading(false);
    }
  };

  // debounced autosave for notes
  useEffect(() => {
    if (!selectedCourse || notesLoadedFor.current !== selectedCourse.id) return;
    if (notes === lastSavedRef.current) return;
    setNotesStatus('saving');
    const t = setTimeout(async () => {
      try {
        await saveNotes(selectedCourse.id, notes);
        lastSavedRef.current = notes;
        setNotesStatus('saved');
      } catch { setNotesStatus('idle'); }
    }, 800);
    return () => clearTimeout(t);
  }, [notes, selectedCourse]);

  const handleVideoWatched = useCallback(async (v: CourseVideo) => {
    if (!selectedCourse) return;
    const key = videoKey(v);
    if ((courseProgress?.videosWatched || []).includes(key)) return;
    try {
      await markVideoWatched(selectedCourse.id, key);
      setCourseProgress((prev: any) => ({ ...prev, videosWatched: [...(prev?.videosWatched || []), key] }));
    } catch (err) { console.error('Failed to mark video watched', err); }
  }, [selectedCourse, courseProgress]);

  const closeCourse = () => {
    setSelectedCourse(null);
    setCourseProgress(null);
    setQuizSubmitted(false);
    setQuizResults(null);
    setQuizAnswers({});
    setNotes(''); setNotesStatus('idle'); notesLoadedFor.current = null;
    loadCourses();
  };

  const handleMarkReadingComplete = async () => {
    if (!selectedCourse) return;
    try {
      await markReadingComplete(selectedCourse.id);
      setCourseProgress((prev: any) => ({ ...prev, readingCompleted: true }));
    } catch (err) { console.error('Failed to mark reading complete:', err); }
  };

  const handleMarkPracticeComplete = async () => {
    if (!selectedCourse) return;
    try {
      await markPracticeComplete(selectedCourse.id);
      setCourseProgress((prev: any) => ({ ...prev, practiceCompleted: true }));
    } catch (err) { console.error('Failed to mark practice complete:', err); }
  };

  const handleQuizSubmit = async () => {
    if (!selectedCourse) return;
    const unanswered = selectedCourse.quizzes.filter(q => !quizAnswers[q.id]);
    if (unanswered.length > 0) { alert('Please answer all questions before submitting.'); return; }
    setSubmittingQuiz(true);
    try {
      const answers = Object.entries(quizAnswers).map(([quizId, selectedAnswer]) => ({ quizId, selectedAnswer }));
      const result = await submitQuiz(selectedCourse.id, answers);
      setQuizResults({ score: result.quizScore, passed: result.quizPassed, results: result.results });
      setQuizSubmitted(true);
      setCourseProgress(result.progress);
      if (result.quizPassed) loadCourses();
    } catch (err: any) {
      console.error('Failed to submit quiz:', err);
      alert(err?.response?.data?.message || 'Could not submit the quiz. Please try again.');
    }
    finally { setSubmittingQuiz(false); }
  };

  const retryQuiz = () => { setQuizAnswers({}); setQuizSubmitted(false); setQuizResults(null); };

  const diffColor = (d: string) =>
    d === 'beginner' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'
      : d === 'intermediate' ? 'bg-amber-50 text-amber-700 ring-amber-600/15'
        : d === 'advanced' ? 'bg-red-50 text-red-700 ring-red-600/15'
          : 'bg-slate-100 text-slate-600 ring-slate-500/10';

  if (loading) {
    return <div className="page flex items-center justify-center min-h-[60vh]"><Loader text="Loading courses..." /></div>;
  }

  /* ── Course Detail View ───────────────────────────────── */
  if (selectedCourse) {
    const videos = selectedCourse.content.videos || [];
    const watchedKeys: string[] = courseProgress?.videosWatched || [];
    const watchedCount = videos.filter(v => watchedKeys.includes(videoKey(v))).length;
    const allVideosWatched = videos.length === 0 || watchedCount === videos.length;
    const quizUnlocked = !!courseProgress?.quizPassed || (!!courseProgress?.readingCompleted && !!courseProgress?.practiceCompleted && allVideosWatched);

    const tabs = [
      { key: 'reading' as const, label: 'Reading', icon: BookOpen, done: !!courseProgress?.readingCompleted, locked: false },
      { key: 'videos' as const, label: videos.length ? `Videos ${watchedCount}/${videos.length}` : 'Videos', icon: Film, done: videos.length > 0 && allVideosWatched, locked: false },
      { key: 'practice' as const, label: 'Practice', icon: ClipboardCheck, done: !!courseProgress?.practiceCompleted, locked: false },
      { key: 'quiz' as const, label: `Quiz (${selectedCourse.quizzes.length})`, icon: GraduationCap, done: !!courseProgress?.quizPassed, locked: !quizUnlocked },
    ];

    const notesStatusLabel = notesStatus === 'saving' ? 'Saving…' : notesStatus === 'saved' ? 'Saved ✓' : '';

    return (
      <div className="page max-w-6xl">
        <button onClick={closeCourse} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-5 reveal">
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </button>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ── Main column ── */}
          <div className="flex-1 min-w-0 w-full">
            <div className="card p-6 mb-6 reveal">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedCourse.title}</h1>
                <span className={`pill ring-1 ring-inset capitalize ${diffColor(selectedCourse.difficulty)}`}>{selectedCourse.difficulty}</span>
              </div>
              <p className="text-slate-500 text-sm mt-2">{selectedCourse.description}</p>

              <div className="flex flex-wrap gap-2 mt-5">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <t.icon className="w-4 h-4" /> {t.label}
                    {t.locked ? <Lock className={`w-3.5 h-3.5 ${activeTab === t.key ? 'text-white' : 'text-slate-400'}`} />
                      : t.done && <CheckCircle2 className={`w-4 h-4 ${activeTab === t.key ? 'text-white' : 'text-emerald-500'}`} />}
                  </button>
                ))}
              </div>
            </div>

            {courseLoading ? <Loader text="Loading course..." /> : (
              <>
                {activeTab === 'reading' && (
                  <div className="card p-7 reveal">
                    <div className="prose prose-slate max-w-none">
                      {selectedCourse.content.readingMaterial.split('\n\n').map((p, idx) => (
                        <p key={idx} className="text-slate-700 leading-relaxed mb-4">{p}</p>
                      ))}
                    </div>
                    <div className="mt-7 pt-6 border-t border-slate-100">
                      {!courseProgress?.readingCompleted ? (
                        <button onClick={handleMarkReadingComplete} className="btn btn-sky"><CheckCircle2 className="w-5 h-5" /> Mark as Read</button>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-emerald-600 font-semibold text-sm"><CheckCircle2 className="w-5 h-5" /> Reading completed</span>
                          <button onClick={() => setActiveTab('videos')} className="btn btn-primary">Watch the Videos <ArrowRight className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'videos' && (
                  <div className="card p-7 reveal">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Watch & Learn</h2>
                    <p className="text-slate-500 text-sm mb-5">Watch each video, then mark it as watched. You must watch all {videos.length || 'the'} videos to unlock the quiz.</p>
                    {videos.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No videos for this module yet.</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {videos.map((v, i) => {
                          const key = videoKey(v);
                          const watched = watchedKeys.includes(key);
                          return (
                            <div key={i} className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white flex flex-col">
                              {v.youtubeId ? (
                                <div className="relative aspect-video bg-black">
                                  <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
                                    title={v.title} loading="lazy" allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                </div>
                              ) : (
                                <a href={ytSearchUrl(v.query || v.title)} target="_blank" rel="noreferrer" onClick={() => handleVideoWatched(v)}
                                  className="relative aspect-video bg-gradient-to-br from-slate-800 to-ink-900 flex flex-col items-center justify-center text-white hover:opacity-95 transition-opacity">
                                  <PlayCircle className="w-12 h-12 mb-1.5 opacity-90" />
                                  <span className="text-sm font-semibold px-4 text-center">Watch on YouTube</span>
                                  <span className="text-[11px] text-white/60 mt-0.5">opens a search for this topic</span>
                                </a>
                              )}
                              <div className="p-4 flex-1 flex flex-col">
                                <p className="font-semibold text-slate-900 text-sm leading-snug">{v.title}</p>
                                {v.channel && <p className="text-xs text-slate-400 mt-0.5">{v.channel}</p>}
                                {v.description && <p className="text-xs text-slate-500 mt-1.5">{v.description}</p>}
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                                  <button onClick={() => handleVideoWatched(v)} disabled={watched}
                                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${watched ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    {watched ? <><Check className="w-3.5 h-3.5" /> Watched</> : 'Mark as watched'}
                                  </button>
                                  {v.youtubeId && (
                                    <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noreferrer" onClick={() => handleVideoWatched(v)}
                                      className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium"><ExternalLink className="w-3.5 h-3.5" /> Open</a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-7 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <span className={`flex items-center gap-2 text-sm font-semibold ${allVideosWatched ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {allVideosWatched ? <CheckCircle2 className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />} {watchedCount}/{videos.length} watched
                      </span>
                      <button onClick={() => setActiveTab('practice')} className="btn btn-primary">Continue to Practice <ArrowRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                {activeTab === 'practice' && (
                  <div className="card p-7 reveal">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Practice Questions</h2>
                    <p className="text-slate-500 text-sm mb-5">Think through these to reinforce what you learned.</p>
                    <div className="space-y-3">
                      {selectedCourse.content.practiceQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-4 bg-sky-50/60 rounded-xl border border-sky-100">
                          <span className="shrink-0 w-7 h-7 bg-sky-600 text-white rounded-lg flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                          <p className="text-slate-800 font-medium text-sm pt-0.5">{q}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-7 pt-6 border-t border-slate-100">
                      {!courseProgress?.practiceCompleted ? (
                        <button onClick={handleMarkPracticeComplete} className="btn btn-sky"><CheckCircle2 className="w-5 h-5" /> I've reviewed these</button>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-emerald-600 font-semibold text-sm"><CheckCircle2 className="w-5 h-5" /> Practice completed</span>
                          {quizUnlocked ? (
                            <button onClick={() => setActiveTab('quiz')} className="btn btn-primary">Take the Quiz <ArrowRight className="w-4 h-4" /></button>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600"><Lock className="w-3.5 h-3.5" /> Watch all videos to unlock the quiz</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'quiz' && !quizUnlocked && (
                  <div className="card p-8 reveal text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Lock className="w-8 h-8 text-slate-400" /></div>
                    <h3 className="text-lg font-bold text-slate-900">Finish the module to unlock the quiz</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">Work through every step so the quiz actually tests what you've learned.</p>
                    <div className="max-w-xs mx-auto mt-5 space-y-2.5 text-left">
                      {[
                        { label: 'Read the material', done: !!courseProgress?.readingCompleted },
                        { label: `Watch all videos (${watchedCount}/${videos.length})`, done: allVideosWatched },
                        { label: 'Review the practice questions', done: !!courseProgress?.practiceCompleted },
                      ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-2.5 text-sm font-medium ${s.done ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {s.done ? <CheckCircle2 className="w-5 h-5" /> : <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />}
                          {s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'quiz' && quizUnlocked && (
                  <div className="space-y-5 reveal">
                    {!quizSubmitted ? (
                  <>
                    <div className="flex items-start gap-2.5 rounded-xl p-4 bg-sky-50 border border-sky-100">
                      <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                      <p className="text-sky-800 text-sm font-medium">Answer all {selectedCourse.quizzes.length} questions. Score 60% or higher to pass and unlock the next course.</p>
                    </div>
                    {selectedCourse.quizzes.map((quiz, idx) => (
                      <div key={quiz.id} className="card p-6">
                        <div className="flex items-start gap-3.5">
                          <span className="shrink-0 w-9 h-9 bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">{idx + 1}</span>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-slate-900 mb-4">{quiz.question}</h3>
                            <div className="space-y-2.5">
                              {quiz.options.map((option, optIdx) => {
                                const selected = quizAnswers[quiz.id] === option;
                                return (
                                  <label key={optIdx} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                    <input type="radio" name={quiz.id} value={option} checked={selected} onChange={() => setQuizAnswers(prev => ({ ...prev, [quiz.id]: option }))} className="w-4 h-4 text-sky-600 accent-sky-600" />
                                    <span className="text-slate-800 text-sm">{option}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button onClick={handleQuizSubmit} disabled={submittingQuiz} className="btn btn-primary px-8 py-3.5">
                        {submittingQuiz ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</> : <><GraduationCap className="w-5 h-5" /> Submit Quiz</>}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-5">
                    {/* Score Card */}
                    <div className={`card p-8 text-center ${quizResults?.passed ? 'ring-2 ring-emerald-200' : 'ring-2 ring-red-200'}`}>
                      <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4 ${quizResults?.passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {quizResults?.passed ? <Trophy className="w-10 h-10 text-emerald-600" /> : <X className="w-10 h-10 text-red-600" />}
                      </div>
                      <h2 className={`text-4xl font-bold mb-1 ${quizResults?.passed ? 'text-emerald-700' : 'text-red-700'}`}>{quizResults?.score}%</h2>
                      <p className={`text-base font-semibold ${quizResults?.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                        {quizResults?.passed ? '🎉 Congratulations! You passed!' : 'Keep learning and try again!'}
                      </p>
                      {quizResults?.passed && <p className="text-emerald-600 text-sm mt-1">The next course has been unlocked.</p>}
                    </div>
                    {/* Detailed Results */}
                    <div className="card p-6">
                      <h3 className="text-base font-bold text-slate-900 mb-4">Your Answers</h3>
                      <div className="space-y-3">
                        {quizResults?.results.map(result => (
                          <div key={result.quizId} className={`p-4 rounded-xl border-2 ${result.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                              <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white ${result.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>{result.isCorrect ? '✓' : '✗'}</span>
                              <div>
                                <p className="font-medium text-slate-900 text-sm">{result.question}</p>
                                <p className="text-sm mt-1.5"><span className="text-slate-500">Your answer: </span><span className={result.isCorrect ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>{result.selectedAnswer}</span></p>
                                {!result.isCorrect && <p className="text-sm"><span className="text-slate-500">Correct answer: </span><span className="text-emerald-700 font-medium">{result.correctAnswer}</span></p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-center gap-3">
                      {!quizResults?.passed && <button onClick={retryQuiz} className="btn btn-sky"><RefreshCw className="w-4 h-4" /> Try Again</button>}
                      <button onClick={closeCourse} className="btn btn-secondary">Back to Courses</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
          </div>

          {/* ── Notes side panel ── */}
          {notesOpen ? (
            <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-4 reveal">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <NotebookPen className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-bold text-slate-900">My Notes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {notesStatusLabel && <span className={`text-[11px] font-medium ${notesStatus === 'saved' ? 'text-emerald-500' : 'text-slate-400'}`}>{notesStatusLabel}</span>}
                    <button onClick={() => setNotesOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Hide notes"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Jot down your own notes while you learn — they autosave and stay with this course."
                  className="w-full h-[420px] resize-none p-4 text-sm text-slate-700 leading-relaxed focus:outline-none placeholder:text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 px-1">Notes are private to you and saved per course.</p>
            </aside>
          ) : (
            <button onClick={() => setNotesOpen(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100 transition-colors reveal">
              <NotebookPen className="w-4 h-4" /> My Notes
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Course List View ─────────────────────────────────── */
  const level = !userStats ? 'Beginner'
    : userStats.totalCoursesCompleted === 0 ? 'Beginner'
      : userStats.totalCoursesCompleted < 5 ? 'Learner'
        : userStats.totalCoursesCompleted < 8 ? 'Intermediate' : 'Advanced';
  const pct = userStats ? Math.round((userStats.totalCoursesCompleted / userStats.totalCourses) * 100) : 0;

  return (
    <div className="page">
      <PageHeader icon={GraduationCap} title="Learn Stocks" subtitle="Master the Pakistan Stock Market, step by step" accent="violet" />

      {/* Progress hero */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-9">
          <div className="reveal stagger-1 rounded-2xl p-5 text-white bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 shadow-lg relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
            <p className="text-sm text-white/80 relative">Courses Completed</p>
            <p className="text-3xl font-bold mt-1 relative font-display">{userStats.totalCoursesCompleted} <span className="text-white/60 text-xl">/ {userStats.totalCourses}</span></p>
            <div className="mt-3 h-2 bg-white/25 rounded-full overflow-hidden relative">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-white/70 mt-1.5 relative">{pct}% of the path complete</p>
          </div>
          <div className="reveal stagger-2 rounded-2xl p-5 text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
            <p className="text-sm text-white/80 relative">Current Level</p>
            <p className="text-3xl font-bold mt-1 relative font-display">{level}</p>
            <p className="text-xs text-white/70 mt-2 relative flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Keep going to level up</p>
          </div>
          <div className="reveal stagger-3 rounded-2xl p-5 text-white bg-gradient-to-br from-brand-500 to-orange-600 shadow-lg relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
            <p className="text-sm text-white/80 relative">Next Up</p>
            <p className="text-lg font-bold mt-1 relative truncate">{courses[userStats.currentCourseIndex]?.title || 'All complete! 🎉'}</p>
            <p className="text-xs text-white/70 mt-2 relative">Continue where you left off</p>
          </div>
        </div>
      )}

      {/* Course path */}
      <div className="relative space-y-3">
        {/* connecting line */}
        <div className="hidden sm:block absolute left-[39px] top-6 bottom-6 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
        {courses.map((course, index) => {
          const completed = course.progress.status === 'completed';
          const inProgress = course.progress.status === 'in_progress';
          const prog = ((course.progress.readingCompleted ? 1 : 0) + (course.progress.practiceCompleted ? 1 : 0) + (course.progress.quizPassed ? 1 : 0)) / 3 * 100;
          return (
            <div key={course.id}
              className={`relative reveal rounded-2xl border overflow-hidden transition-all duration-300 ${course.isUnlocked ? 'bg-white border-slate-200/80 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer' : 'bg-slate-50 border-slate-200/60 opacity-80'}`}
              style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
              onClick={() => course.isUnlocked && openCourse(course.id)}>
              <div className="p-5 flex items-center gap-4">
                {/* Step node */}
                <div className={`relative z-10 shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ring-4 ring-white ${completed ? 'bg-emerald-100' : course.isUnlocked ? 'bg-gradient-to-br from-sky-500 to-indigo-600' : 'bg-slate-200'}`}>
                  {completed ? <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    : course.isUnlocked ? (inProgress ? <Zap className="w-6 h-6 text-white" /> : <span className="text-xl font-bold text-white">{index + 1}</span>)
                      : <Lock className="w-6 h-6 text-slate-400" />}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-base font-bold ${course.isUnlocked ? 'text-slate-900' : 'text-slate-400'}`}>{course.title}</h3>
                    <span className={`pill ring-1 ring-inset capitalize ${diffColor(course.difficulty)}`}>{course.difficulty}</span>
                  </div>
                  <p className={`text-sm mt-0.5 line-clamp-2 ${course.isUnlocked ? 'text-slate-500' : 'text-slate-400'}`}>{course.description}</p>
                  {course.isUnlocked && course.progress.status !== 'not_started' && (
                    <div className="flex items-center gap-4 mt-2.5 text-xs">
                      <span className={`flex items-center gap-1 ${course.progress.readingCompleted ? 'text-emerald-600' : 'text-slate-400'}`}><BookOpen className="w-3.5 h-3.5" /> Reading</span>
                      <span className={`flex items-center gap-1 ${course.progress.practiceCompleted ? 'text-emerald-600' : 'text-slate-400'}`}><ClipboardCheck className="w-3.5 h-3.5" /> Practice</span>
                      <span className={`flex items-center gap-1 ${course.progress.quizPassed ? 'text-emerald-600' : 'text-slate-400'}`}><GraduationCap className="w-3.5 h-3.5" /> Quiz {course.progress.quizPassed && `(${course.progress.quizScore}%)`}</span>
                    </div>
                  )}
                </div>
                {/* Action */}
                <div className="shrink-0 text-sm font-semibold">
                  {course.isUnlocked ? (
                    <span className={`inline-flex items-center gap-1.5 ${completed ? 'text-emerald-600' : 'text-sky-600'}`}>
                      {completed ? 'Review' : inProgress ? 'Continue' : 'Start'} <ArrowRight className="w-4 h-4" />
                    </span>
                  ) : <span className="text-slate-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Locked</span>}
                </div>
              </div>
              {course.isUnlocked && inProgress && (
                <div className="h-1 bg-slate-100"><div className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500" style={{ width: `${prog}%` }} /></div>
              )}
            </div>
          );
        })}

        {courses.length === 0 && (
          <div className="text-center py-16">
            <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-slate-900">No courses available</h3>
            <p className="text-slate-500 text-sm mt-1">Check back later for new content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
