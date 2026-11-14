'use strict';

const { verifyToken } = require('../services/auth');
const { getDb } = require('../services/db');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'missing or invalid authorization header' });
  }
  try {
    const payload = verifyToken(parts[1]);
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, country, language, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'user not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token invalid or expired' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    try {
      const payload = verifyToken(parts[1]);
      const db = getDb();
      const user = db.prepare('SELECT id, email, name, country, language, is_active FROM users WHERE id = ?').get(payload.sub);
      if (user && user.is_active) req.user = user;
    } catch (err) {
      // ignore, continue as anonymous
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
