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
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
