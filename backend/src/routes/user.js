const express = require('express');
const User = require('../models/User');
const Stock = require('../models/Stock');
const auth = require('../middleware/auth');
const trading = require('../services/trading');

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

// PUT /api/user/profile  — update display name and/or avatar
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      updates.name = req.body.name.trim();
    }
    if (req.body.avatar !== undefined) {
      // accept a data URL / URL string, or null/'' to remove
      const avatar = req.body.avatar;
      if (avatar && typeof avatar === 'string') {
        if (avatar.length > 3_000_000) {
          return res.status(400).json({ message: 'Image too large. Please choose a smaller photo.' });
        }
        updates.avatar = avatar;
      } else {
        updates.avatar = '';
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, select: '-password' }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Failed to update profile', err);
    res.status(500).json({ message: 'Unable to update profile' });
  }
});

// GET /api/user/watchlist
router.get('/watchlist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('watchlist');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ watchlist: user.watchlist || [] });
  } catch (err) {
    console.error('Failed to get watchlist', err);
    res.status(500).json({ message: 'Unable to load watchlist' });
  }
});

// POST /api/user/watchlist  { symbol }
router.post('/watchlist', auth, async (req, res) => {
  try {
    const symbol = (req.body.symbol || '').toUpperCase();
    if (!symbol) return res.status(400).json({ message: 'symbol is required' });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { watchlist: symbol } },
      { new: true, select: 'watchlist' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    console.error('Failed to add to watchlist', err);
    res.status(500).json({ message: 'Unable to update watchlist' });
  }
});

// DELETE /api/user/watchlist/:symbol
router.delete('/watchlist/:symbol', auth, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { watchlist: symbol } },
      { new: true, select: 'watchlist' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    console.error('Failed to remove from watchlist', err);
    res.status(500).json({ message: 'Unable to update watchlist' });
  }
});

// GET /api/user/balance — current cash wallet
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ balance: user.balance || 0 });
  } catch (err) {
    console.error('Failed to get balance', err);
    res.status(500).json({ message: 'Unable to load balance' });
  }
});

// POST /api/user/credit  { amount } — add cash to the wallet
router.post('/credit', auth, async (req, res) => {
  try {
    const user = await trading.credit(req.user.id, req.body.amount);
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to add credit' });
  }
});

// POST /api/user/buy  { symbol, quantity } — buy shares using the wallet
router.post('/buy', auth, async (req, res) => {
  try {
    const { user, price, cost } = await trading.buy(req.user.id, req.body.symbol, req.body.quantity);
    res.json({ portfolio: user.portfolio, balance: user.balance, price, cost });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to buy' });
  }
});

// POST /api/user/sell  { symbol, quantity? } — sell shares, crediting the wallet
router.post('/sell', auth, async (req, res) => {
  try {
    const { user, price, proceeds } = await trading.sell(req.user.id, req.body.symbol, req.body.quantity);
    res.json({ portfolio: user.portfolio, balance: user.balance, price, proceeds });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to sell' });
  }
});

// GET /api/user/portfolio
router.get('/portfolio', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('portfolio balance');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ portfolio: user.portfolio || [], balance: user.balance || 0 });
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
