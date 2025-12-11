const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    symbol: { type: String, index: true, required: true },
    predictedPrice: { type: Number },
    predictedReturn: { type: Number },
    signal: { type: String },
    confidence: { type: Number },
    currentPrice: { type: Number },
    predictionDate: { type: String },
    horizonDays: { type: Number },
    ensembleAgreement: { type: Number },
    modelPredictions: { type: mongoose.Schema.Types.Mixed },
    technicalIndicators: { type: mongoose.Schema.Types.Mixed },
    reasoning: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

PredictionSchema.index({ user: 1, symbol: 1 }, { unique: true });

PredictionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => ({
    id: ret._id,
    symbol: ret.symbol,
    predictedPrice: ret.predictedPrice,
    predictedReturn: ret.predictedReturn,
    signal: ret.signal,
    confidence: ret.confidence,
    currentPrice: ret.currentPrice,
    predictionDate: ret.predictionDate,
    horizonDays: ret.horizonDays,
    ensembleAgreement: ret.ensembleAgreement,
    modelPredictions: ret.modelPredictions,
    technicalIndicators: ret.technicalIndicators,
    reasoning: ret.reasoning,
    updatedAt: ret.updatedAt,
  }),
});

module.exports = mongoose.model('Prediction', PredictionSchema);