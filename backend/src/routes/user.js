const express = require('express');
const User = require('../models/User');
const Stock = require('../models/Stock');
const Prediction = require('../models/Prediction');
const auth = require('../middleware/auth');
const fetch = global.fetch;

const router = express.Router();

const PREDICTION_API_BASE = process.env.PREDICTION_API_BASE || 'http://localhost:5000/api/predict';

function formatPrediction(prediction) {
  if (!prediction) return null;
  return {
    id: prediction._id,
    symbol: prediction.symbol,
    predictedPrice: prediction.predictedPrice,
    predictedReturn: prediction.predictedReturn,
    signal: prediction.signal,
    confidence: prediction.confidence,
    currentPrice: prediction.currentPrice,
    predictionDate: prediction.predictionDate,
    horizonDays: prediction.horizonDays,
    ensembleAgreement: prediction.ensembleAgreement,
    modelPredictions: prediction.modelPredictions,
    technicalIndicators: prediction.technicalIndicators,
    reasoning: prediction.reasoning,
    updatedAt: prediction.updatedAt,
  };
}

function buildPredictionUrl(symbol) {
  const base = PREDICTION_API_BASE.endsWith('/')
    ? PREDICTION_API_BASE.slice(0, -1)
    : PREDICTION_API_BASE;
  return `${base}/${encodeURIComponent(symbol)}`;
}

function extractFieldsFromPayload(symbol, payload) {
  const data = payload?.data || {};
  return {
    symbol: (data.ticker || symbol || '').toUpperCase(),
    predictedPrice: Number(data.predicted_price ?? data?.model_predictions?.ensemble) || undefined,
    predictedReturn: typeof data.predicted_return === 'number' ? data.predicted_return : undefined,
    signal: (data.signal || '').toUpperCase() || undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    currentPrice: typeof data.current_price === 'number' ? data.current_price : undefined,
    predictionDate: data.prediction_date || data.predictionDate,
    horizonDays: data.prediction_horizon_days,
    ensembleAgreement: typeof data.ensemble_agreement === 'number' ? data.ensemble_agreement : undefined,
    modelPredictions: data.model_predictions,
    technicalIndicators: data.technical_indicators,
    reasoning: data.reasoning,
    raw: data,
  };
}

async function fetchAndStorePrediction(userId, symbol) {
  if (!fetch) return null;
  const url = buildPredictionUrl(symbol);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Prediction API error: ${resp.status}`);
    const payload = await resp.json();
    if (!payload?.data) throw new Error('Prediction API returned no data');

    const fields = extractFieldsFromPayload(symbol, payload);

    const saved = await Prediction.findOneAndUpdate(
      { user: userId, symbol: fields.symbol },
      { $set: { ...fields } },
      { upsert: true, new: true }
    ).lean();

    return formatPrediction(saved);
  } catch (err) {
    console.error(`Prediction fetch failed for ${symbol}:`, err.message || err);
    return null;
  }
}

async function getPredictionMap(userId, symbols) {
  if (!symbols?.length) return {};
  const docs = await Prediction.find({
    user: userId,
    symbol: { $in: symbols },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const map = {};
  for (const doc of docs) {
    if (!map[doc.symbol]) {
      map[doc.symbol] = formatPrediction(doc);
    }
  }
  return map;
}

// GET /api/user/preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ preferences: user.preferences });
  } catch (err) {
    console.error('Failed to get preferences', err);
    res.status(500).json({ message: 'Unable to load preferences' });
  }
});

// PUT /api/user/preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const allowedFields = [
      'riskTolerance',
      'sectors',
      'investmentHorizon',
      'marketCapFocus',
      'dividendPreference',
    ];
    const updates = {};
    allowedFields.forEach((key) => {
      if (req.body[key] !== undefined) updates[`preferences.${key}`] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, select: 'preferences' }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ preferences: user.preferences });
  } catch (err) {
    console.error('Failed to update preferences', err);
    res.status(500).json({ message: 'Unable to save preferences' });
  }
});

// GET /api/user/portfolio
router.get('/portfolio', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('portfolio');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const symbols = (user.portfolio || []).map((p) => p.symbol);
    const predictions = await getPredictionMap(req.user.id, symbols);
    res.json({ portfolio: user.portfolio || [], predictions });
  } catch (err) {
    console.error('Failed to get portfolio', err);
    res.status(500).json({ message: 'Unable to load portfolio' });
  }
});

// POST /api/user/portfolio
router.post('/portfolio', auth, async (req, res) => {
  try {
    const { symbol, quantity, averageCost } = req.body;
    if (!symbol || quantity === undefined) {
      return res.status(400).json({ message: 'symbol and quantity are required' });
    }

    const upperSymbol = symbol.toUpperCase();
    const parsedQty = Number(quantity);
    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      return res.status(400).json({ message: 'quantity must be a positive number' });
    }

    const exists = await Stock.findOne({ SYMBOL: upperSymbol }).lean();
    if (!exists) return res.status(400).json({ message: 'Symbol not found in market data' });

    const update = {
      'portfolio.$[item].quantity': parsedQty,
    };

    if (averageCost !== undefined) {
      const parsedCost = Number(averageCost);
      if (Number.isNaN(parsedCost) || parsedCost < 0) {
        return res.status(400).json({ message: 'averageCost must be a positive number' });
      }
      update['portfolio.$[item].averageCost'] = parsedCost;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user.id, 'portfolio.symbol': upperSymbol },
      { $set: update },
      {
        arrayFilters: [{ 'item.symbol': upperSymbol }],
        new: true,
        select: 'portfolio',
      }
    );

    let portfolioDoc = user;
    if (!portfolioDoc) {
      portfolioDoc = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          portfolio: {
            symbol: upperSymbol,
            quantity: parsedQty,
            averageCost: averageCost !== undefined ? Number(averageCost) : undefined,
          },
        },
      },
        { new: true, select: 'portfolio' }
      );
    }

    const symbols = (portfolioDoc.portfolio || []).map((p) => p.symbol);

    // Fetch prediction in the background but wait to include it in the response when available.
    let prediction = null;
    try {
      prediction = await fetchAndStorePrediction(req.user.id, upperSymbol);
    } catch (err) {
      console.error('Error storing prediction', err);
    }

    const predictions = await getPredictionMap(req.user.id, symbols);
    if (prediction && prediction.symbol) {
      predictions[prediction.symbol] = prediction;
    }

    res.json({ portfolio: portfolioDoc.portfolio, predictions });
  } catch (err) {
    console.error('Failed to upsert portfolio item', err);
    res.status(500).json({ message: 'Unable to save portfolio item' });
  }
});

// DELETE /api/user/portfolio/:symbol
router.delete('/portfolio/:symbol', auth, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { portfolio: { symbol } } },
      { new: true, select: 'portfolio' }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    await Prediction.deleteMany({ user: req.user.id, symbol });
    const symbols = (user.portfolio || []).map((p) => p.symbol);
    const predictions = await getPredictionMap(req.user.id, symbols);

    res.json({ portfolio: user.portfolio, predictions });
  } catch (err) {
    console.error('Failed to remove portfolio item', err);
    res.status(500).json({ message: 'Unable to remove portfolio item' });
  }
});

module.exports = router;
