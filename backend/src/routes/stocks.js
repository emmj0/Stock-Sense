const express = require('express');
const Stock = require('../models/Stock');

const router = express.Router();

const KSE30_SYMBOLS = [
  'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
  'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
  'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL',
];

// GET /api/stocks?search=LPL&limit=100&kse30=true
router.get('/', async (req, res) => {
  try {
    const { search, limit = 200, kse30 } = req.query;
    const cap = Math.min(parseInt(limit, 10) || 200, 500);

    const filter = {};

    // Default to KSE-30 only unless explicitly requesting all
    if (kse30 !== 'false') {
      filter.SYMBOL = { $in: KSE30_SYMBOLS };
    }

    if (search) {
      if (filter.SYMBOL) {
        // Search within KSE-30
        filter.$and = [
          { SYMBOL: filter.SYMBOL },
          { SYMBOL: { $regex: new RegExp(search, 'i') } },
        ];
        delete filter.SYMBOL;
      } else {
        filter.SYMBOL = { $regex: new RegExp(search, 'i') };
      }
    }

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
