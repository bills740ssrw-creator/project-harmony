'use strict';

const express = require('express');
const { z } = require('zod');
const {
  generateId, hashPassword, comparePassword, signToken, verifyToken,
  hashToken, createSession, verifySession, revokeSession, revokeAllSessions,
} = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  country: z.string().length(2).optional().default('US'),
  language: z.string().length(2).optional().default('en'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  country: z.string().length(2).optional(),
  language: z.string().length(2).optional(),
  phone: z.string().max(20).optional(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existing) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const id = generateId();
    const passwordHash = hashPassword(body.password);
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, country, language) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, body.email, passwordHash, body.name, body.country, body.language);
    const user = db.prepare('SELECT id, email, name, country, language, created_at FROM users WHERE id = ?').get(id);
    const token = signToken({ sub: user.id });
    createSession({ db, userId: user.id, token, expiresInMs: 7 * 24 * 60 * 60 * 1000 });
    db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    return res.status(201).json({ user, token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/login', (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email);
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    if (!comparePassword(body.password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'account is inactive' });
    }
    const token = signToken({ sub: user.id });
    createSession({ db, userId: user.id, token, expiresInMs: 7 * 24 * 60 * 60 * 1000 });
    db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    return res.json({
      user: { id: user.id, email: user.email, name: user.name, country: user.country, language: user.language },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.get('/me', authenticate, (req, res) => {
  return res.json({ user: req.user });
});

router.patch('/profile', authenticate, (req, res) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const db = getDb();
    const fields = [];
    const params = [];
    for (const key of ['name', 'country', 'language', 'phone']) {
      if (key in body) {
        fields.push(`${key} = ?`);
        params.push(body[key]);
      }
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }
    fields.push('updated_at = ?');
    params.push(new Date().toISOString(), req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    const user = db.prepare('SELECT id, email, name, country, language, phone, updated_at FROM users WHERE id = ?').get(req.user.id);
    return res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.delete('/account', authenticate, (req, res) => {
  try {
    const db = getDb();
    revokeAllSessions({ db, userId: req.user.id });
    db.prepare('UPDATE couple_members SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE users SET is_active = 0, email = ?, updated_at = ? WHERE id = ?')
      .run(`deleted_${req.user.id}`, new Date().toISOString(), req.user.id);
    return res.json({ ok: true, message: 'account deactivated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/password-reset-request', (req, res) => {
  try {
    const body = passwordResetRequestSchema.parse(req.body);
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1').get(body.email);
    if (!user) {
      return res.json({ ok: true, message: 'if the account exists, a reset link was sent' });
    }
    db.prepare('UPDATE password_reset_tokens SET is_active = 0, used_at = ? WHERE user_id = ? AND is_active = 1')
      .run(new Date().toISOString(), user.id);
    const token = generateId();
    const id = generateId();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
    ).run(id, user.id, token, expiresAt);
    return res.json({
      ok: true,
      message: 'password reset token generated',
      ...(process.env.NODE_ENV === 'development' ? { reset_token: token } : {}),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/password-reset', (req, res) => {
  try {
    const body = passwordResetSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();
    const reset = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND is_active = 1 AND used_at IS NULL AND expires_at > ?'
    ).get(body.token, now);
    if (!reset) {
      return res.status(400).json({ error: 'invalid or expired reset token' });
    }
    const passwordHash = hashPassword(body.new_password);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, reset.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = ?, is_active = 0 WHERE id = ?').run(now, reset.id);
    revokeAllSessions({ db, userId: reset.user_id });
    return res.json({ ok: true, message: 'password reset successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/refresh', authenticate, (req, res) => {
  try {
    const db = getDb();
    const token = req.headers.authorization.split(' ')[1];
    const session = verifySession({ db, token });
    if (!session) {
      return res.status(401).json({ error: 'session not found' });
    }
    const newToken = signToken({ sub: session.user.id });
    revokeSession({ db, token });
    createSession({ db, userId: session.user.id, token: newToken, expiresInMs: 7 * 24 * 60 * 60 * 1000 });
    return res.json({
      user: session.user,
      token: newToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/logout', authenticate, (req, res) => {
  try {
    const db = getDb();
    const token = req.headers.authorization.split(' ')[1];
    revokeSession({ db, token });
    return res.json({ ok: true, message: 'logged out' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

module.exports = router;
