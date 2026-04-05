const express = require('express');
const Prediction = require('../models/Prediction');
const Recommendation = require('../models/Recommendation');
const Stock = require('../models/Stock');
const auth = require('../middleware/auth');

const router = express.Router();

const KSE30_SYMBOLS = [
  'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
  'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
  'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL',
];

/**
 * Fetch live prices from market_watch and merge into predictions.
 * This ensures currentPrice always reflects the latest market data,
 * not the stale price from when the model last ran.
 */
async function enrichWithLivePrices(predictions) {
  const symbols = predictions.map((p) => p.symbol);
  const liveStocks = await Stock.find({ SYMBOL: { $in: symbols } }).lean();

  const liveMap = {};
  for (const s of liveStocks) {
    const price = parseFloat((s.CURRENT || '0').replace(/,/g, ''));
    if (price > 0) liveMap[s.SYMBOL] = price;
  }

  return predictions.map((pred) => {
    const livePrice = liveMap[pred.symbol];
    if (livePrice) {
      const predictedReturn =
        ((pred.predictedPrice - livePrice) / livePrice) * 100;
      return {
        ...pred,
        currentPrice: livePrice,
        predictedReturn: Math.round(predictedReturn * 10) / 10,
      };
    }
    return pred;
  });
}

// GET /api/predictions — all predictions (public)
router.get('/', async (req, res) => {
  try {
    const { signal, sector, sort } = req.query;
    const filter = {};

    if (signal) filter.signal = signal.toUpperCase();
    if (sector) filter.sector = { $regex: sector, $options: 'i' };

    let sortOption = { confidence: -1 };
    if (sort === 'return') sortOption = { predictedReturn: -1 };
    if (sort === 'symbol') sortOption = { symbol: 1 };

    let predictions = await Prediction.find(filter).sort(sortOption).lean();

    // Enrich with live prices from market_watch
    predictions = await enrichWithLivePrices(predictions);

    // Re-sort if sorting by return (since returns were recalculated)
    if (sort === 'return') {
      predictions.sort((a, b) => b.predictedReturn - a.predictedReturn);
    }

    res.json({
      predictions,
      total: predictions.length,
      summary: {
        buy: predictions.filter((p) => p.signal === 'BUY').length,
        sell: predictions.filter((p) => p.signal === 'SELL').length,
        hold: predictions.filter((p) => p.signal === 'HOLD').length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch predictions', error: err.message });
  }
});

// GET /api/predictions/recommendations — latest recommendations with live prices
router.get('/recommendations', async (req, res) => {
  try {
    const rec = await Recommendation.findOne().sort({ createdAt: -1 }).lean();
    if (!rec) {
      return res.json({ recommendations: null, message: 'No recommendations available' });
    }

    // Fetch live prices for all symbols in recommendations
    const allSymbols = [
      ...(rec.topBuys || []).map((r) => r.symbol),
      ...(rec.topSells || []).map((r) => r.symbol),
    ];
    const liveStocks = await Stock.find({ SYMBOL: { $in: allSymbols } }).lean();
    const liveMap = {};
    for (const s of liveStocks) {
      const price = parseFloat((s.CURRENT || '0').replace(/,/g, ''));
      if (price > 0) liveMap[s.SYMBOL] = price;
    }

    // Update prices in recommendations
    const updateRec = (item) => {
      const livePrice = liveMap[item.symbol];
      if (livePrice) {
        const ret = ((item.predicted_price - livePrice) / livePrice) * 100;
        return {
          ...item,
          current_price: livePrice,
          predicted_return: Math.round(ret * 10) / 10,
        };
      }
      return item;
    };

    rec.topBuys = (rec.topBuys || []).map(updateRec);
    rec.topSells = (rec.topSells || []).map(updateRec);

    res.json({ recommendations: rec });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recommendations', error: err.message });
  }
});

// GET /api/predictions/user/portfolio — predictions for user's portfolio stocks (auth required)
router.get('/user/portfolio', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).lean();

    if (!user || !user.portfolio || user.portfolio.length === 0) {
      return res.json({ predictions: [], message: 'No stocks in portfolio' });
    }

    const symbols = user.portfolio.map((item) => item.symbol);
    let predictions = await Prediction.find({ symbol: { $in: symbols } }).lean();

    // Enrich with live prices
    predictions = await enrichWithLivePrices(predictions);

    // Enrich with user's holding data
    const enriched = predictions.map((pred) => {
      const holding = user.portfolio.find((h) => h.symbol === pred.symbol);
      return {
        ...pred,
        holding: holding
          ? {
              quantity: holding.quantity,
              averageCost: holding.averageCost,
              invested: holding.quantity * (holding.averageCost || 0),
              currentValue: holding.quantity * (pred.currentPrice || 0),
            }
          : null,
      };
    });

    res.json({ predictions: enriched });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch portfolio predictions', error: err.message });
  }
});

// GET /api/predictions/:symbol — single stock prediction with live price
router.get('/:symbol', async (req, res) => {
  try {
    const prediction = await Prediction.findOne({
      symbol: req.params.symbol.toUpperCase(),
    }).lean();

    if (!prediction) {
      return res.status(404).json({ message: 'Prediction not found for this symbol' });
    }

    // Enrich with live price
    const [enriched] = await enrichWithLivePrices([prediction]);

    res.json({ prediction: enriched });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch prediction', error: err.message });
  }
});

module.exports = router;
