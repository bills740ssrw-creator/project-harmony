'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authenticate);

const createCoupleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  partner_email: z.string().email().optional(),
});

router.get('/', (req, res) => {
  const db = getDb();
  const memberships = db.prepare(
    `SELECT c.id, c.name, c.status, c.created_at, c.updated_at, cm.role, cm.joined_at
     FROM couples c
     JOIN couple_members cm ON cm.couple_id = c.id
     WHERE cm.user_id = ? AND cm.is_active = 1 AND c.status = 'active'
     ORDER BY c.updated_at DESC`
  ).all(req.user.id);
  return res.json({ couples: memberships });
});

router.post('/', (req, res) => {
  try {
    const body = createCoupleSchema.parse(req.body);
    const db = getDb();
    const coupleId = generateId();
    const now = new Date().toISOString();
    const insertCouple = db.prepare(
      'INSERT INTO couples (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    const insertMember = db.prepare(
      'INSERT INTO couple_members (id, couple_id, user_id, role, joined_at, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    );
    const tx = db.transaction(() => {
      insertCouple.run(coupleId, body.name || `Couple ${coupleId.slice(0, 6)}`, 'active', now, now);
      insertMember.run(generateId(), coupleId, req.user.id, 'partner', now);
      if (body.partner_email) {
        const partner = db.prepare('SELECT id FROM users WHERE email = ?').get(body.partner_email);
        if (partner) {
          insertMember.run(generateId(), coupleId, partner.id, 'partner', now);
        }
      }
    });
    tx();
    const couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(coupleId);
    return res.status(201).json({ couple });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.get('/:coupleId', (req, res) => {
  const db = getDb();
  const membership = db.prepare(
    `SELECT cm.id, cm.role, cm.joined_at FROM couple_members cm
     WHERE cm.couple_id = ? AND cm.user_id = ? AND cm.is_active = 1`
  ).get(req.params.coupleId, req.user.id);
  if (!membership) {
    return res.status(404).json({ error: 'couple not found or access denied' });
  }
  const couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(req.params.coupleId);
  const members = db.prepare(
    `SELECT u.id, u.name, u.email, u.country, u.language, u.avatar_url, cm.role, cm.joined_at
     FROM couple_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.couple_id = ? AND cm.is_active = 1 AND u.is_active = 1`
  ).all(req.params.coupleId);
  return res.json({ couple, members, role: membership.role });
});

module.exports = router;
