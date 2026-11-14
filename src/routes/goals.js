'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const goalSchema = z.object({
  couple_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  target_date: z.string().optional(),
});

const commitmentSchema = z.object({
  couple_id: z.string().min(1),
  goal_id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  owner_id: z.string().min(1),
  due_date: z.string().optional(),
});

// ---- Goals ----
router.get('/:coupleId', (req, res) => {
  const db = getDb();
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const goals = db.prepare('SELECT * FROM goals WHERE couple_id = ? ORDER BY created_at DESC').all(req.params.coupleId);
  return res.json({ goals });
});

router.post('/', (req, res) => {
  try {
    const body = goalSchema.parse(req.body);
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
      'INSERT INTO goals (id, couple_id, title, description, target_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.title, body.description || null, body.target_date || null, req.user.id, now, now);
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    return res.status(201).json({ goal });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/:goalId', (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT couple_id FROM goals WHERE id = ?').get(req.params.goalId);
  if (!goal) {
    return res.status(404).json({ error: 'goal not found' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(goal.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const fields = [];
  const params = [];
  for (const key of ['title', 'description', 'status', 'target_date']) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), req.params.goalId);
  db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return res.json({ ok: true });
});

// ---- Commitments ----
router.get('/commitments/:coupleId', (req, res) => {
  const db = getDb();
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const commitments = db.prepare(
    'SELECT * FROM commitments WHERE couple_id = ? ORDER BY created_at DESC'
  ).all(req.params.coupleId);
  return res.json({ commitments });
});

router.post('/commitments', (req, res) => {
  try {
    const body = commitmentSchema.parse(req.body);
    const db = getDb();
    const member = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    // owner must be a member of the couple
    const owner = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(body.couple_id, body.owner_id);
    if (!owner) {
      return res.status(400).json({ error: 'owner must be a couple member' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO commitments (id, couple_id, goal_id, title, description, owner_id, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.goal_id || null, body.title, body.description || null, body.owner_id, body.due_date || null, now, now);
    const commitment = db.prepare('SELECT * FROM commitments WHERE id = ?').get(id);
    return res.status(201).json({ commitment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/commitments/:commitmentId', (req, res) => {
  const db = getDb();
  const commitment = db.prepare('SELECT couple_id FROM commitments WHERE id = ?').get(req.params.commitmentId);
  if (!commitment) {
    return res.status(404).json({ error: 'commitment not found' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(commitment.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const fields = [];
  const params = [];
  for (const key of ['title', 'description', 'status', 'due_date', 'owner_id']) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), req.params.commitmentId);
  db.prepare(`UPDATE commitments SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return res.json({ ok: true });
});

module.exports = router;
