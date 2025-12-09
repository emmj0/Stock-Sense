const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true },
  },
  { _id: false }
);

const ContentSchema = new mongoose.Schema(
  {
    readingMaterial: { type: String, required: true },
    practiceQuestions: [{ type: String }],
  },
  { _id: false }
);

const CourseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true 
  },
  description: { type: String, required: true },
  content: ContentSchema,
  quizzes: [QuizSchema],
  order: { type: Number, default: 0 }, // For sorting courses
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Course', CourseSchema);
