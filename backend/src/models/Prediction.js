const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, index: true },
    companyName: { type: String },
    sector: { type: String },
    signal: { type: String, enum: ['BUY', 'SELL', 'HOLD'], required: true },
    confidence: { type: Number },
    currentPrice: { type: Number },
    predictedPrice: { type: Number },
    predictedReturn: { type: Number },
    horizonDays: { type: Number, default: 7 },
    priceRange: {
      low: { type: Number },
      high: { type: Number },
    },
    forecastDays: {
      bullish: { type: Number },
      bearish: { type: Number },
      neutral: { type: Number },
    },
    strength: { type: Number },
    reasoning: { type: String },
    confidenceNote: { type: String },
    // Rich fields (from FastAPI --from-api mode)
    priceForecast7d: [{ type: Number }],
    quantileForecast7d: {
      q10: [{ type: Number }],
      q25: [{ type: Number }],
      q50: [{ type: Number }],
      q75: [{ type: Number }],
      q90: [{ type: Number }],
    },
    llmReasoning: { type: String },
    riskFactors: [{ type: String }],
    sentiment: {
      score: { type: Number },
      confidence: { type: Number },
      source: { type: String },
      key_headlines: [{ type: String }],
      reasoning: { type: String },
    },
    trustLevel: { type: String, enum: ['high', 'medium', 'low'] },
    trustNote: { type: String },
    dataAsOf: { type: String },
    modelVersion: { type: String, default: 'v1' },
    timestamp: { type: String },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'predictions' }
);

module.exports = mongoose.model('Prediction', PredictionSchema);
