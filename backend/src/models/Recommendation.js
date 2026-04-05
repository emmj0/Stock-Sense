const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema(
  {
    topBuys: [
      {
        symbol: String,
        sector: String,
        current_price: Number,
        predicted_price: Number,
        predicted_return: Number,
        confidence: Number,
        reasoning: String,
      },
    ],
    topSells: [
      {
        symbol: String,
        sector: String,
        current_price: Number,
        predicted_price: Number,
        predicted_return: Number,
        confidence: Number,
        reasoning: String,
      },
    ],
    summary: {
      total_buys: Number,
      total_sells: Number,
      total_hold: Number,
      total_stocks: Number,
    },
    sourceTimestamp: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'recommendations' }
);

module.exports = mongoose.model('Recommendation', RecommendationSchema);
