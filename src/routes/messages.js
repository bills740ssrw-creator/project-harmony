'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const sendSchema = z.object({
  couple_id: z.string().min(1),
  content: z.string().min(1).max(5000),
  type: z.enum(['text', 'system', 'ai_mediation', 'ai_coaching']).optional().default('text'),
});

router.get('/:coupleId', (req, res) => {
  const db = getDb();
  const { limit = 50, before } = req.query;
  // Verify membership
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(404).json({ error: 'couple not found or access denied' });
  }
  let sql = `SELECT m.id, m.sender_id, m.content, m.type, m.metadata, m.read_at, m.created_at,
                    u.name AS sender_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.couple_id = ?`;
  const params = [req.params.coupleId];
  if (before) {
    sql += ` AND m.created_at < ?`;
    params.push(before);
  }
  sql += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(parseInt(limit, 10));
  const rows = db.prepare(sql).all(...params).reverse();
  return res.json({ messages: rows });
});

router.post('/', (req, res) => {
  try {
    const body = sendSchema.parse(req.body);
    const db = getDb();
    const member = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, couple_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, req.user.id, body.content, body.type, now);
    const message = db.prepare(
      `SELECT m.id, m.sender_id, m.content, m.type, m.metadata, m.created_at, u.name AS sender_name
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
    ).get(id);
    return res.status(201).json({ message });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/:messageId/read', (req, res) => {
  const db = getDb();
  const message = db.prepare('SELECT sender_id, couple_id FROM messages WHERE id = ?').get(req.params.messageId);
  if (!message) {
    return res.status(404).json({ error: 'message not found' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(message.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  db.prepare('UPDATE messages SET read_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.messageId);
  return res.json({ ok: true });
});

module.exports = router;
