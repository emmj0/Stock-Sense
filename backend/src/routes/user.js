const express = require('express');
const User = require('../models/User');
const Stock = require('../models/Stock');
const auth = require('../middleware/auth');

const router = express.Router();

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
    res.json({ portfolio: user.portfolio || [] });
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

    if (user) {
      return res.json({ portfolio: user.portfolio });
    }

    const updated = await User.findByIdAndUpdate(
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

    res.json({ portfolio: updated.portfolio });
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
    res.json({ portfolio: user.portfolio });
  } catch (err) {
    console.error('Failed to remove portfolio item', err);
    res.status(500).json({ message: 'Unable to remove portfolio item' });
  }
});

module.exports = router;
