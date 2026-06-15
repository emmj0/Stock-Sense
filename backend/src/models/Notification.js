const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  symbol: { type: String },
  type: { type: String, enum: ['up', 'down', 'steady', 'info', 'buy', 'sell', 'credit'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String },
  // the prediction's "as of" stamp this notification was generated from — used to dedupe
  predictionAsOf: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// one notification per (user, symbol, prediction update)
NotificationSchema.index({ user: 1, symbol: 1, predictionAsOf: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
