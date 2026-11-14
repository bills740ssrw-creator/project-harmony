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

const inviteSchema = z.object({
  email: z.string().email(),
});

const joinSchema = z.object({
  token: z.string().min(1),
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

router.post('/invite', (req, res) => {
  try {
    const body = inviteSchema.parse(req.body);
    const db = getDb();
    const membership = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(req.body.couple_id, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'access denied' });
    }
    const couple = db.prepare('SELECT id FROM couples WHERE id = ?').get(req.body.couple_id);
    if (!couple) {
      return res.status(404).json({ error: 'couple not found' });
    }
    const token = generateId();
    const id = generateId();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO invitation_tokens (id, couple_id, token, inviter_id, email, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(id, couple.id, token, req.user.id, body.email, expiresAt);
    return res.json({
      ok: true,
      message: 'invitation created',
      ...(process.env.NODE_ENV === 'development' ? { invitation_token: token } : {}),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.post('/join', (req, res) => {
  try {
    const body = joinSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();
    const invitation = db.prepare(
      'SELECT * FROM invitation_tokens WHERE token = ? AND is_active = 1 AND used_at IS NULL AND expires_at > ?'
    ).get(body.token, now);
    if (!invitation) {
      return res.status(400).json({ error: 'invalid or expired invitation token' });
    }
    // Check user is not already a member
    const existing = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(invitation.couple_id, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'already a member of this couple' });
    }
    const memberId = generateId();
    db.prepare(
      'INSERT INTO couple_members (id, couple_id, user_id, role, joined_at, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(memberId, invitation.couple_id, req.user.id, 'partner', now);
    db.prepare('UPDATE invitation_tokens SET used_at = ?, is_active = 0 WHERE id = ?').run(now, invitation.id);
    return res.json({ ok: true, message: 'joined couple', couple_id: invitation.couple_id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.delete('/:coupleId/leave', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(req.params.coupleId, req.user.id);
    if (!membership) {
      return res.status(404).json({ error: 'couple membership not found' });
    }
    db.prepare('UPDATE couple_members SET is_active = 0 WHERE couple_id = ? AND user_id = ?')
      .run(req.params.coupleId, req.user.id);
    // If no active members remain, deactivate the couple
    const remaining = db.prepare(
      'SELECT COUNT(*) AS cnt FROM couple_members WHERE couple_id = ? AND is_active = 1'
    ).get(req.params.coupleId);
    if (remaining.cnt === 0) {
      db.prepare('UPDATE couples SET status = ?, updated_at = ? WHERE id = ?')
        .run('archived', new Date().toISOString(), req.params.coupleId);
    }
    return res.json({ ok: true, message: 'left couple' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

module.exports = router;
