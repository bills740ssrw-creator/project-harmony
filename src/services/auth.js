'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateId() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(config.bcryptSaltRounds);
  return bcrypt.hashSync(password, salt);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// --- Session management ---

function hashToken(token) {
  return crypto.createHmac('sha256', config.jwtSecret).update(token).digest('hex');
}

function createSession({ db, userId, token, expiresInMs }) {
  const id = generateId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  const tokenHash = hashToken(token);
  db.prepare(
    'INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)'
  ).run(id, userId, tokenHash, now, now, expiresAt);
  return { id, userId, expiresAt };
}

function verifySession({ db, token }) {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const session = db.prepare(
    'SELECT * FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?'
  ).get(tokenHash, now);
  if (!session) return null;
  // touch last_used_at
  db.prepare('UPDATE user_sessions SET last_used_at = ? WHERE id = ?').run(now, session.id);
  const user = db.prepare('SELECT id, email, name, country, language, is_active FROM users WHERE id = ? AND is_active = 1').get(session.user_id);
  if (!user) return null;
  return { session, user };
}

function revokeSession({ db, token }) {
  const tokenHash = hashToken(token);
  db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(new Date().toISOString(), tokenHash);
}

function revokeAllSessions({ db, userId }) {
  db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), userId);
}

module.exports = {
  generateId,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  hashToken,
  createSession,
  verifySession,
  revokeSession,
  revokeAllSessions,
};
