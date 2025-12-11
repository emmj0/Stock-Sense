const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema(
  {
    topBuys: { type: Array, default: [] },
    topSells: { type: Array, default: [] },
    summary: {
      total_buys: { type: Number },
      total_sells: { type: Number },
    },
    topN: { type: Number, default: 5 },
    sourceTimestamp: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: 'recommendations',
  }
);

RecommendationSchema.index({ topN: 1 }, { unique: true });

RecommendationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => ({
    id: ret._id,
    topBuys: ret.topBuys,
    topSells: ret.topSells,
    summary: ret.summary,
    topN: ret.topN,
    sourceTimestamp: ret.sourceTimestamp,
    updatedAt: ret.updatedAt,
  }),
});

module.exports = mongoose.model('Recommendation', RecommendationSchema);