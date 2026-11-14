'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId, hashPassword, comparePassword, signToken } = require('../services/auth');
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

module.exports = router;
