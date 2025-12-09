const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/courses - Get all courses (with user progress if authenticated)
router.get('/', auth, async (req, res) => {
  try {
    const courses = await Course.find({}).sort({ order: 1 });
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Map courses with user progress and lock status
    const coursesWithProgress = courses.map((course, index) => {
      const progress = user.courseProgress.find(p => p.courseId === course.id);
      const isUnlocked = index <= user.currentCourseIndex;
      
      return {
        id: course.id,
        title: course.title,
        difficulty: course.difficulty,
        description: course.description,
        order: course.order,
        quizCount: course.quizzes.length,
        isUnlocked,
        progress: progress ? {
          status: progress.status,
          readingCompleted: progress.readingCompleted,
          practiceCompleted: progress.practiceCompleted,
          quizScore: progress.quizScore,
          quizPassed: progress.quizPassed,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
        } : {
          status: 'not_started',
          readingCompleted: false,
          practiceCompleted: false,
          quizScore: 0,
          quizPassed: false,
        }
      };
    });

    res.json({ 
      courses: coursesWithProgress,
      userStats: {
        currentCourseIndex: user.currentCourseIndex,
        totalCoursesCompleted: user.totalCoursesCompleted,
        totalCourses: courses.length,
      }
    });
  } catch (err) {
    console.error('Failed to fetch courses', err);
    res.status(500).json({ message: 'Unable to fetch courses', error: err.message });
  }
});

// GET /api/courses/:courseId - Get single course with full content
router.get('/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findOne({ id: courseId });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if course is unlocked
    const courseIndex = course.order - 1;
    if (courseIndex > user.currentCourseIndex) {
      return res.status(403).json({ message: 'Course is locked. Complete previous courses first.' });
    }

    // Get user's progress for this course
    const progress = user.courseProgress.find(p => p.courseId === courseId);

    res.json({
      course: {
        id: course.id,
        title: course.title,
        difficulty: course.difficulty,
        description: course.description,
        content: course.content,
        quizzes: course.quizzes.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          // Don't send correct answer to frontend
        })),
        order: course.order,
      },
      progress: progress || {
        status: 'not_started',
        readingCompleted: false,
        practiceCompleted: false,
        quizAttempts: [],
        quizScore: 0,
        quizPassed: false,
      }
    });
  } catch (err) {
    console.error('Failed to fetch course', err);
    res.status(500).json({ message: 'Unable to fetch course', error: err.message });
  }
});

// POST /api/courses/:courseId/start - Start a course
router.post('/:courseId/start', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const course = await Course.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if course is unlocked
    const courseIndex = course.order - 1;
    if (courseIndex > user.currentCourseIndex) {
      return res.status(403).json({ message: 'Course is locked' });
    }

    // Find or create progress entry
    let progressIndex = user.courseProgress.findIndex(p => p.courseId === courseId);
    
    if (progressIndex === -1) {
      user.courseProgress.push({
        courseId,
        status: 'in_progress',
        startedAt: new Date(),
      });
    } else if (user.courseProgress[progressIndex].status === 'not_started') {
      user.courseProgress[progressIndex].status = 'in_progress';
      user.courseProgress[progressIndex].startedAt = new Date();
    }

    await user.save();

    res.json({ message: 'Course started', progress: user.courseProgress.find(p => p.courseId === courseId) });
  } catch (err) {
    console.error('Failed to start course', err);
    res.status(500).json({ message: 'Unable to start course', error: err.message });
  }
});

// POST /api/courses/:courseId/reading-complete - Mark reading as complete
router.post('/:courseId/reading-complete', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let progressIndex = user.courseProgress.findIndex(p => p.courseId === courseId);
    
    if (progressIndex === -1) {
      user.courseProgress.push({
        courseId,
        status: 'in_progress',
        readingCompleted: true,
        startedAt: new Date(),
      });
    } else {
      user.courseProgress[progressIndex].readingCompleted = true;
      if (user.courseProgress[progressIndex].status === 'not_started') {
        user.courseProgress[progressIndex].status = 'in_progress';
        user.courseProgress[progressIndex].startedAt = new Date();
      }
    }

    await user.save();

    res.json({ message: 'Reading marked as complete', progress: user.courseProgress.find(p => p.courseId === courseId) });
  } catch (err) {
    console.error('Failed to mark reading complete', err);
    res.status(500).json({ message: 'Unable to update progress', error: err.message });
  }
});

// POST /api/courses/:courseId/practice-complete - Mark practice questions as complete
router.post('/:courseId/practice-complete', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let progressIndex = user.courseProgress.findIndex(p => p.courseId === courseId);
    
    if (progressIndex === -1) {
      user.courseProgress.push({
        courseId,
        status: 'in_progress',
        practiceCompleted: true,
        startedAt: new Date(),
      });
    } else {
      user.courseProgress[progressIndex].practiceCompleted = true;
    }

    await user.save();

    res.json({ message: 'Practice marked as complete', progress: user.courseProgress.find(p => p.courseId === courseId) });
  } catch (err) {
    console.error('Failed to mark practice complete', err);
    res.status(500).json({ message: 'Unable to update progress', error: err.message });
  }
});

// POST /api/courses/:courseId/submit-quiz - Submit quiz answers
router.post('/:courseId/submit-quiz', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body; // Array of { quizId, selectedAnswer }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const course = await Course.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Grade the quiz
    const quizAttempts = [];
    let correctCount = 0;

    for (const answer of answers) {
      const quiz = course.quizzes.find(q => q.id === answer.quizId);
      if (quiz) {
        const isCorrect = quiz.correctAnswer === answer.selectedAnswer;
        if (isCorrect) correctCount++;
        
        quizAttempts.push({
          quizId: answer.quizId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          attemptedAt: new Date(),
        });
      }
    }

    const totalQuizzes = course.quizzes.length;
    const quizScore = totalQuizzes > 0 ? Math.round((correctCount / totalQuizzes) * 100) : 0;
    const quizPassed = quizScore >= 60; // Pass threshold: 60%

    // Update user progress
    let progressIndex = user.courseProgress.findIndex(p => p.courseId === courseId);
    
    if (progressIndex === -1) {
      user.courseProgress.push({
        courseId,
        status: quizPassed ? 'completed' : 'in_progress',
        quizAttempts,
        quizScore,
        quizPassed,
        startedAt: new Date(),
        completedAt: quizPassed ? new Date() : undefined,
      });
      progressIndex = user.courseProgress.length - 1;
    } else {
      user.courseProgress[progressIndex].quizAttempts = quizAttempts;
      user.courseProgress[progressIndex].quizScore = quizScore;
      user.courseProgress[progressIndex].quizPassed = quizPassed;
      
      if (quizPassed && user.courseProgress[progressIndex].status !== 'completed') {
        user.courseProgress[progressIndex].status = 'completed';
        user.courseProgress[progressIndex].completedAt = new Date();
      }
    }

    // If quiz passed, unlock next course
    if (quizPassed) {
      const courseIndex = course.order - 1;
      if (courseIndex === user.currentCourseIndex) {
        user.currentCourseIndex = courseIndex + 1;
        user.totalCoursesCompleted = (user.totalCoursesCompleted || 0) + 1;
      }
    }

    await user.save();

    // Return results with correct answers for review
    const results = answers.map(answer => {
      const quiz = course.quizzes.find(q => q.id === answer.quizId);
      return {
        quizId: answer.quizId,
        question: quiz?.question,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: quiz?.correctAnswer,
        isCorrect: quiz?.correctAnswer === answer.selectedAnswer,
      };
    });

    res.json({
      message: quizPassed ? 'Congratulations! You passed the quiz!' : 'Quiz completed. Try again to pass.',
      quizScore,
      quizPassed,
      correctCount,
      totalQuizzes,
      results,
      nextCourseUnlocked: quizPassed,
      progress: user.courseProgress[progressIndex],
    });
  } catch (err) {
    console.error('Failed to submit quiz', err);
    res.status(500).json({ message: 'Unable to submit quiz', error: err.message });
  }
});

// GET /api/courses/user/progress - Get overall user learning progress
router.get('/user/progress', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalCourses = await Course.countDocuments();

    res.json({
      currentCourseIndex: user.currentCourseIndex,
      totalCoursesCompleted: user.totalCoursesCompleted || 0,
      totalCourses,
      courseProgress: user.courseProgress,
    });
  } catch (err) {
    console.error('Failed to fetch user progress', err);
    res.status(500).json({ message: 'Unable to fetch progress', error: err.message });
  }
});

module.exports = router;
