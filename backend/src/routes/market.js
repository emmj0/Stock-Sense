const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /api/market/indexes
router.get('/indexes', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Debug: List all collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Try multiple collection names
    let indexes = [];
    for (const collName of ['psx.index', 'psx_index', 'index', 'indexes']) {
      try {
        const data = await db.collection(collName).find({}).toArray();
        if (data && data.length > 0) {
          console.log(`Found ${data.length} indexes in collection: ${collName}`);
          indexes = data;
          break;
        }
      } catch (e) {
        // Collection doesn't exist, continue
        continue;
      }
    }

    if (indexes.length === 0) {
      console.warn('No index data found in any collection');
    }

    res.json({ indexes });
  } catch (err) {
    console.error('Failed to fetch indexes', err);
    res.status(500).json({ message: 'Unable to fetch indexes', error: err.message });
  }
});

// GET /api/market/sectors
router.get('/sectors', async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Try multiple collection names
    let sectors = [];
    for (const collName of ['psx.sector', 'psx_sector', 'sector', 'sectors']) {
      try {
        const data = await db.collection(collName).find({}).toArray();
        if (data && data.length > 0) {
          console.log(`Found ${data.length} sectors in collection: ${collName}`);
          sectors = data;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (sectors.length === 0) {
      console.warn('No sector data found in any collection');
    }

    res.json({ sectors });
  } catch (err) {
    console.error('Failed to fetch sectors', err);
    res.status(500).json({ message: 'Unable to fetch sectors', error: err.message });
  }
});

// GET /api/market/watch?sector=AUTOMOBILE%20ASSEMBLER&index=KSE100
router.get('/watch', async (req, res) => {
  try {
    const { sector, index } = req.query;
    const db = mongoose.connection.db;

    let filter = {};
    if (sector) filter.sector = { $in: [sector] };
    if (index) filter.index = { $in: [index] };

    // Try multiple collection names
    let stocks = [];
    for (const collName of ['psx.market_watch', 'psx_market_watch', 'market_watch', 'watch']) {
      try {
        const data = await db
          .collection(collName)
          .find(filter)
          .limit(100)
          .toArray();
        if (data && data.length > 0) {
          console.log(`Found ${data.length} stocks in collection: ${collName}`);
          stocks = data;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (stocks.length === 0) {
      console.warn('No market watch data found in any collection');
    }

    res.json({ stocks });
  } catch (err) {
    console.error('Failed to fetch market watch', err);
    res.status(500).json({ message: 'Unable to fetch market watch', error: err.message });
  }
});

module.exports = router;
