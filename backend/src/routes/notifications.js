const express = require('express');
const Notification = require('../models/Notification');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Generate notifications for a user whenever the AI predictions covering their
 * portfolio + watchlist have been updated. Dedupes on the prediction's
 * "as of" stamp so each prediction update yields exactly one notification.
 */
async function generateForUser(userId) {
  const user = await User.findById(userId).select('portfolio watchlist').lean();
  if (!user) return;

  const symbols = [...new Set([
    ...(user.portfolio || []).map((p) => p.symbol),
    ...(user.watchlist || []),
  ])].filter(Boolean);
  if (symbols.length === 0) return;

  const preds = await Prediction.find({ symbol: { $in: symbols } }).lean();

  for (const p of preds) {
    const asOf = String(p.dataAsOf || p.timestamp || (p.updatedAt ? new Date(p.updatedAt).toISOString() : '') || '');
    const exists = await Notification.findOne({ user: userId, symbol: p.symbol, predictionAsOf: asOf }).lean();
    if (exists) continue;

    const r = typeof p.predictedReturn === 'number' ? p.predictedReturn : 0;
    const type = r > 1.5 ? 'up' : r < -1.5 ? 'down' : 'steady';
    const dir = type === 'up' ? 'could go up' : type === 'down' ? 'could go down' : 'looks steady';
    const target = p.predictedPrice ? ` Target ~Rs ${Math.round(p.predictedPrice)}.` : '';
    const title = `${p.symbol} ${dir}`;
    const message = `Updated AI outlook: ${r > 0 ? '+' : ''}${(Math.round(r * 10) / 10)}% expected over ~7 days.${target}`;

    try {
      await Notification.create({ user: userId, symbol: p.symbol, type, title, message, predictionAsOf: asOf });
    } catch (e) {
      // ignore duplicate-key races
    }
  }

  // keep only the 60 most recent per user
  const old = await Notification.find({ user: userId }).sort({ createdAt: -1 }).skip(60).select('_id').lean();
  if (old.length) await Notification.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

// GET /api/notifications — generate from latest predictions, then return list
router.get('/', auth, async (req, res) => {
  try {
    await generateForUser(req.user.id);
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Failed to load notifications', err);
    res.status(500).json({ message: 'Failed to load notifications' });
  }
});

// PATCH /api/notifications/:id — toggle a single notification's read state
router.patch('/:id', auth, async (req, res) => {
  try {
    const read = !!req.body.read;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { read } },
      { new: true }
    ).lean();
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    console.error('Failed to update notification', err);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to mark notifications read', err);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

module.exports = router;
