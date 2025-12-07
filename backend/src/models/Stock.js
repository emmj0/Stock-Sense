const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema(
  {
    SYMBOL: { type: String, index: true },
    CHANGE: { type: String },
    'CHANGE (%)': { type: String },
    CURRENT: { type: String },
    HIGH: { type: String },
    LDCP: { type: String },
    LOW: { type: String },
    OPEN: { type: String },
    VOLUME: { type: String },
  },
  {
    collection: 'market_watch',
    timestamps: false,
  }
);

// Provide a cleaner payload for API consumers.
StockSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => ({
    id: ret._id,
    symbol: ret.SYMBOL,
    change: ret.CHANGE,
    changePercent: ret['CHANGE (%)'],
    current: ret.CURRENT,
    high: ret.HIGH,
    ldcp: ret.LDCP,
    low: ret.LOW,
    open: ret.OPEN,
    volume: ret.VOLUME,
  }),
});

module.exports = mongoose.model('Stock', StockSchema);
