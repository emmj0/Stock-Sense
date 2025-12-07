const express = require('express');
const Stock = require('../models/Stock');

const router = express.Router();

// GET /api/stocks?search=LPL&limit=100
router.get('/', async (req, res) => {
  try {
    const { search, limit = 200 } = req.query;
    const cap = Math.min(parseInt(limit, 10) || 200, 500);

    const filter = search
      ? { SYMBOL: { $regex: new RegExp(search, 'i') } }
      : {};

    const stocks = await Stock.find(filter).limit(cap).lean();
    res.json({ stocks: stocks.map((s) => Stock.hydrate(s).toJSON()) });
  } catch (err) {
    console.error('Failed to fetch stocks', err);
    res.status(500).json({ message: 'Unable to fetch stocks' });
  }
});

// GET /api/stocks/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const stock = await Stock.findOne({ SYMBOL: symbol }).lean();
    if (!stock) return res.status(404).json({ message: 'Stock not found' });
    res.json({ stock: Stock.hydrate(stock).toJSON() });
  } catch (err) {
    console.error('Failed to fetch stock', err);
    res.status(500).json({ message: 'Unable to fetch stock' });
  }
});

module.exports = router;
