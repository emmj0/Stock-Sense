const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const stockRoutes = require('./routes/stocks');
const marketRoutes = require('./routes/market');
const coursesRoutes = require('./routes/courses');
const chatRoutes = require('./routes/chat');
const predictionsRoutes = require('./routes/predictions');
const notificationsRoutes = require('./routes/notifications');

// Builds and returns the configured Express app WITHOUT connecting to Mongo or
// listening on a port — so tests (Supertest) can import it directly.
function createApp() {
  const app = express();

  const allowedOrigins = process.env.CLIENT_URLS
    ? process.env.CLIENT_URLS.split(',').map((v) => v.trim())
    : ['http://localhost:5173'];

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '3mb' })); // headroom for base64 avatar uploads

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/predictions', predictionsRoutes);
  app.use('/api/notifications', notificationsRoutes);

  // Serve landing page
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

module.exports = createApp;
