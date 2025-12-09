const mongoose = require('mongoose');

const PreferencesSchema = new mongoose.Schema(
  {
    riskTolerance: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive'],
      default: 'moderate',
    },
    sectors: [{ type: String }],
    investmentHorizon: { type: String },
    marketCapFocus: { type: String },
    dividendPreference: { type: String },
  },
  { _id: false }
);

const PortfolioItemSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    averageCost: { type: Number, min: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Quiz attempt tracking
const QuizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true },
    selectedAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    attemptedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Course progress tracking
const CourseProgressSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
    readingCompleted: { type: Boolean, default: false },
    practiceCompleted: { type: Boolean, default: false },
    quizAttempts: [QuizAttemptSchema],
    quizScore: { type: Number, default: 0 }, // percentage score
    quizPassed: { type: Boolean, default: false },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function requiredPassword() {
      return this.authProvider === 'local';
    },
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: { type: String },
  preferences: PreferencesSchema,
  portfolio: [PortfolioItemSchema],
  // Learning progress
  courseProgress: [CourseProgressSchema],
  currentCourseIndex: { type: Number, default: 0 }, // Index of the highest unlocked course
  totalCoursesCompleted: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
