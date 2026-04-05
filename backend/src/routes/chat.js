const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');

const router = express.Router();

const CHATBOT_URL = process.env.CHATBOT_URL || 'http://127.0.0.1:5001';

// All routes require authentication
router.use(auth);

// POST /api/chat/send - Send a message and get AI response
router.post('/send', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, userId: user._id });
      if (!session) return res.status(404).json({ message: 'Session not found' });
    } else {
      session = new ChatSession({ userId: user._id, title: message.slice(0, 60) });
    }

    // Build user context for the chatbot
    const userContext = {
      name: user.name,
      email: user.email,
      portfolio: user.portfolio || [],
      preferences: user.preferences || {},
    };

    // Forward to Python chatbot with user context
    const chatResponse = await axios.post(`${CHATBOT_URL}/api/chat`, {
      message: message.trim(),
      session_id: session._id.toString(),
      user_email: user.email,
      user_context: userContext,
    }, { timeout: 30000 });

    const reply = chatResponse.data.reply || 'Sorry, I could not generate a response.';

    // Save messages to MongoDB session
    session.messages.push({ role: 'user', content: message.trim() });
    session.messages.push({ role: 'assistant', content: reply });
    await session.save();

    res.json({
      reply,
      sessionId: session._id,
      resolvedQuery: chatResponse.data.resolved_query,
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'Chatbot service is unavailable. Please try again later.' });
    }
    res.status(500).json({ message: 'Failed to get response' });
  }
});

// GET /api/chat/sessions - Get all sessions for current user
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user.id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

// GET /api/chat/sessions/:id - Get a specific session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// DELETE /api/chat/sessions/:id - Delete a session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const result = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!result) return res.status(404).json({ message: 'Session not found' });

    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

module.exports = router;
