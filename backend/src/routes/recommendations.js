const express = require('express');
const Recommendation = require('../models/Recommendation');

const router = express.Router();
const fetch = global.fetch;

const RECS_API_BASE = process.env.RECOMMENDATION_API_BASE || 'http://localhost:5000/api/recommendations';

function buildUrl(topN) {
  const base = RECS_API_BASE.endsWith('/') ? RECS_API_BASE.slice(0, -1) : RECS_API_BASE;
  const url = new URL(base);
  if (topN) url.searchParams.set('top_n', String(topN));
  return url.toString();
}

async function fetchRecommendations(topN) {
  const url = buildUrl(topN);
  if (!fetch) throw new Error('fetch not available in runtime');
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Model API error: ${resp.status}`);
  }
  const json = await resp.json();
  if (!json || !json.data) {
    throw new Error('Model API returned no data');
  }
  return json;
}

function mapPayload(topN, payload) {
  const data = payload.data || {};
  return {
    topN: topN || payload.top_n || data.top_n || 5,
    topBuys: data.top_buys || [],
    topSells: data.top_sells || [],
    summary: data.summary || payload.summary,
    sourceTimestamp: payload.timestamp || data.timestamp,
    raw: payload,
  };
}

// GET /api/recommendations?top_n=5
router.get('/', async (req, res) => {
  const topN = Number(req.query.top_n) || 5;
  try {
    const payload = await fetchRecommendations(topN);
    const doc = mapPayload(topN, payload);

    const saved = await Recommendation.findOneAndUpdate(
      { topN: doc.topN },
      { $set: doc },
      { upsert: true, new: true }
    ).lean();

    return res.json({ recommendations: Recommendation.hydrate(saved).toJSON() });
  } catch (err) {
    console.error('Failed to fetch recommendations', err);
    try {
      const cached = await Recommendation.findOne({ topN }).sort({ updatedAt: -1 }).lean();
      if (cached) {
        return res.status(200).json({ recommendations: Recommendation.hydrate(cached).toJSON(), cached: true });
      }
    } catch (_) {
      // ignore cache failures
    }
    res.status(500).json({ message: 'Unable to load recommendations' });
  }
});

module.exports = router;