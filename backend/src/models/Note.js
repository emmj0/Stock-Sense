const mongoose = require('mongoose');

// A user's personal notes for a single course (one document per user+course).
const NoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, required: true },
  content: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

NoteSchema.index({ user: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('Note', NoteSchema);
