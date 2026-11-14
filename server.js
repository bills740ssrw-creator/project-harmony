require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const authRoutes = require('./src/routes/auth');
const coupleRoutes = require('./src/routes/couples');
const messageRoutes = require('./src/routes/messages');
const aiRoutes = require('./src/routes/ai');
const goalRoutes = require('./src/routes/goals');
const intelligenceRoutes = require('./src/routes/intelligence');
const growthRoutes = require('./src/routes/growth');
const { initDb } = require('./src/services/db');
const { startWsServer } = require('./src/services/ws');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Trust proxy (for correct client IPs behind reverse proxies)
app.set('trust proxy', 1);

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'project-harmony', time: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/couples', coupleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/growth', growthRoutes);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback: serve index.html for unknown non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'not found' });
  }
});

// Initialize database, then start server + websocket
initDb()
  .then(() => {
    startWsServer(server);
    server.listen(PORT, () => {
      console.log(`Project Harmony server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = { app, server };
