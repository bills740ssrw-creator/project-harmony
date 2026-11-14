'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { mediate, coach, insight, translate } = require('../services/ai');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const mediateSchema = z.object({
  couple_id: z.string().min(1),
  conversation: z.string().min(1),
});

const coachSchema = z.object({
  couple_id: z.string().optional(),
  message: z.string().min(1),
});

const insightSchema = z.object({
  couple_id: z.string().min(1),
});

const translateSchema = z.object({
  text: z.string().min(1),
  target_language: z.string().length(2).default('en'),
});

router.post('/mediate', async (req, res) => {
  try {
    const body = mediateSchema.parse(req.body);
    const db = getDb();
    const member = db.prepare(
      'SELECT u.language FROM couple_members cm JOIN users u ON u.id = cm.user_id WHERE cm.couple_id = ? AND cm.user_id = ? AND cm.is_active = 1'
    ).get(body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const result = await mediate({
      conversation: body.conversation,
      language: member.language || 'en',
      coupleContext: { coupleId: body.couple_id, userId: req.user.id },
    });
    const sessionId = generateId();
    db.prepare(
      'INSERT INTO ai_sessions (id, couple_id, user_id, type, title, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, body.couple_id, req.user.id, 'mediation', 'Mediation session', JSON.stringify({ conversation: body.conversation }), new Date().toISOString());
    db.prepare(
      'INSERT INTO ai_insights (id, session_id, couple_id, category, insight, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), sessionId, body.couple_id, 'conflict', result.reply, new Date().toISOString());
    return res.json({ ...result, sessionId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/coach', async (req, res) => {
  try {
    const body = coachSchema.parse(req.body);
    let language = 'en';
    let coupleId = null;
    if (body.couple_id) {
      const db = getDb();
      const member = db.prepare(
        'SELECT u.language FROM couple_members cm JOIN users u ON u.id = cm.user_id WHERE cm.couple_id = ? AND cm.user_id = ? AND cm.is_active = 1'
      ).get(body.couple_id, req.user.id);
      if (!member) {
        return res.status(403).json({ error: 'access denied' });
      }
      language = member.language || 'en';
      coupleId = body.couple_id;
    }
    const result = await coach({
      message: body.message,
      language,
      coupleContext: { coupleId, userId: req.user.id },
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/insight', async (req, res) => {
  try {
    const body = insightSchema.parse(req.body);
    const db = getDb();
    const member = db.prepare(
      'SELECT u.language FROM couple_members cm JOIN users u ON u.id = cm.user_id WHERE cm.couple_id = ? AND cm.user_id = ? AND cm.is_active = 1'
    ).get(body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const recent = db.prepare(
      'SELECT m.sender_id, m.content, m.created_at, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.couple_id = ? ORDER BY m.created_at DESC LIMIT 30'
    ).all(body.couple_id);
    const goals = db.prepare('SELECT * FROM goals WHERE couple_id = ? ORDER BY created_at DESC LIMIT 10').all(body.couple_id);
    const result = await insight({
      coupleId: body.couple_id,
      recentMessages: recent.reverse(),
      goals,
      language: member.language || 'en',
    });
    const sessionId = generateId();
    db.prepare(
      'INSERT INTO ai_sessions (id, couple_id, user_id, type, title, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, body.couple_id, req.user.id, 'insight', 'Relationship insight', JSON.stringify({ recent, goals }), new Date().toISOString());
    db.prepare(
      'INSERT INTO ai_insights (id, session_id, couple_id, category, insight, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), sessionId, body.couple_id, 'communication', result.reply, new Date().toISOString());
    return res.json({ ...result, sessionId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/translate', async (req, res) => {
  try {
    const body = translateSchema.parse(req.body);
    const result = await translate({ text: body.text, targetLanguage: body.target_language });
    return res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

module.exports = router;
