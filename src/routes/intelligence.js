'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ---- Helpers ----
function verifyMembership(db, coupleId, userId) {
  return db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(coupleId, userId);
}

function parseJsonField(row, field) {
  if (!row) return row;
  if (row[field]) {
    try { row[field] = JSON.parse(row[field]); } catch { /* leave as-is */ }
  }
  return row;
}

const healthSchema = z.object({
  couple_id: z.string().min(1),
  overall_score: z.number().min(0).max(100),
  communication_score: z.number().min(0).max(100).optional(),
  conflict_resolution_score: z.number().min(0).max(100).optional(),
  intimacy_score: z.number().min(0).max(100).optional(),
  trust_score: z.number().min(0).max(100).optional(),
  goals_score: z.number().min(0).max(100).optional(),
  factors: z.string().optional(),
  note: z.string().optional(),
});

const timelineSchema = z.object({
  couple_id: z.string().min(1),
  event_type: z.enum(['milestone', 'disagreement', 'resolution', 'memory', 'goal', 'commitment', 'insight']),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  event_date: z.string().min(1),
  metadata: z.string().optional(),
  is_public: z.boolean().optional().default(true),
});

const correctionSchema = z.object({
  couple_id: z.string().min(1),
  original_type: z.string().min(1),
  original_id: z.string().min(1),
  field_name: z.string().min(1),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
  reason: z.string().optional(),
});

// ===== Relationship Health Snapshots =====

router.get('/health/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const rows = db.prepare(
    'SELECT * FROM relationship_health WHERE couple_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.coupleId);
  return res.json({ health: rows.map(r => parseJsonField(r, 'factors')) });
});

router.post('/health', (req, res) => {
  try {
    const body = healthSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO relationship_health (id, couple_id, overall_score, communication_score, conflict_resolution_score, intimacy_score, trust_score, goals_score, factors, note, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.overall_score, body.communication_score || null,
      body.conflict_resolution_score || null, body.intimacy_score || null, body.trust_score || null,
      body.goals_score || null, body.factors || null, body.note || null, req.user.id, now);
    const snapshot = db.prepare('SELECT * FROM relationship_health WHERE id = ?').get(id);
    return res.status(201).json({ health: parseJsonField(snapshot, 'factors') });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Relationship Timeline Events =====

router.get('/timeline/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { include_private = 'false' } = req.query;
  const showPrivate = include_private === 'true';
  let sql = `SELECT t.*, u.name AS created_by_name
             FROM timeline_events t
             JOIN users u ON u.id = t.created_by
             WHERE t.couple_id = ?`;
  const params = [req.params.coupleId];
  if (!showPrivate) {
    sql += ` AND t.is_public = 1`;
  }
  sql += ` ORDER BY t.event_date DESC, t.created_at DESC LIMIT 100`;
  const rows = db.prepare(sql).all(...params);
  const events = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));
  return res.json({ timeline: events });
});

router.post('/timeline', (req, res) => {
  try {
    const body = timelineSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO timeline_events (id, couple_id, event_type, title, description, event_date, metadata, is_public, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.event_type, body.title, body.description || null,
      body.event_date, body.metadata || null, body.is_public ? 1 : 0, req.user.id, now, now);
    const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(id);
    event.metadata = event.metadata ? JSON.parse(event.metadata) : null;
    return res.status(201).json({ timeline: event });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/timeline/:eventId', (req, res) => {
  try {
    const db = getDb();
    const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'timeline event not found' });
    }
    const member = verifyMembership(db, event.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    // Only creator or any partner can edit public events; private events only by creator
    if (!event.is_public && event.created_by !== req.user.id) {
      return res.status(403).json({ error: 'only the creator can edit a private memory' });
    }
    const fields = [];
    const params = [];
    for (const key of ['title', 'description', 'event_type', 'event_date', 'is_public']) {
      if (key in req.body) {
        fields.push(`${key} = ?`);
        params.push(key === 'is_public' ? (req.body[key] ? 1 : 0) : req.body[key]);
      }
    }
    if (req.body.metadata) {
      fields.push('metadata = ?');
      params.push(JSON.stringify(req.body.metadata));
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }
    // Record correction for audit if public fields changed
    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now, req.params.eventId);
    db.prepare(`UPDATE timeline_events SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    // Audit correction
    if (fields.length > 1) { // more than just updated_at
      const corrId = generateId();
      db.prepare(
        'INSERT INTO memory_corrections (id, couple_id, original_type, original_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(corrId, event.couple_id, 'timeline_event', event.id, 'updated', null, null, req.user.id, 'timeline event updated', now);
    }
    const updated = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.eventId);
    updated.metadata = updated.metadata ? JSON.parse(updated.metadata) : null;
    return res.json({ timeline: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.delete('/timeline/:eventId', (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.eventId);
  if (!event) {
    return res.status(404).json({ error: 'timeline event not found' });
  }
  const member = verifyMembership(db, event.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  // Only creator can delete; public events can be soft-hidden, private deleted
  if (!event.is_public && event.created_by !== req.user.id) {
    return res.status(403).json({ error: 'only the creator can delete a private memory' });
  }
  if (event.is_public) {
    // Soft-delete public events by marking type and title
    db.prepare('UPDATE timeline_events SET title = ?, description = ?, event_type = ?, updated_at = ? WHERE id = ?')
      .run('[Memory removed]', 'This memory was removed by a partner.', 'removed', new Date().toISOString(), req.params.eventId);
    const corrId = generateId();
    db.prepare(
      'INSERT INTO memory_corrections (id, couple_id, original_type, original_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(corrId, event.couple_id, 'timeline_event', event.id, 'deleted', null, null, req.user.id, 'public memory removed', new Date().toISOString());
  } else {
    db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.eventId);
  }
  return res.json({ ok: true, message: 'memory removed' });
});

// ===== Memory Corrections (audit trail) =====

router.get('/memory-corrections/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const rows = db.prepare(
    `SELECT mc.*, u.name AS corrected_by_name
     FROM memory_corrections mc
     JOIN users u ON u.id = mc.corrected_by
     WHERE mc.couple_id = ?
     ORDER BY mc.corrected_at DESC LIMIT 100`
  ).all(req.params.coupleId);
  return res.json({ corrections: rows });
});

router.post('/memory-corrections', (req, res) => {
  try {
    const body = correctionSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO memory_corrections (id, couple_id, original_type, original_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.original_type, body.original_id, body.field_name,
      body.old_value || null, body.new_value || null, req.user.id, body.reason || null, now);
    return res.status(201).json({ ok: true, correction_id: id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Agreement Tracking (commitments + goals status) =====

router.get('/agreements/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const commitments = db.prepare(
    'SELECT * FROM commitments WHERE couple_id = ? ORDER BY created_at DESC'
  ).all(req.params.coupleId);
  const goals = db.prepare(
    'SELECT * FROM goals WHERE couple_id = ? ORDER BY created_at DESC'
  ).all(req.params.coupleId);
  const total = commitments.length + goals.length;
  const completed = commitments.filter(c => c.status === 'completed').length +
    goals.filter(g => g.status === 'completed').length;
  return res.json({
    agreements: {
      total,
      completed,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      commitments,
      goals,
    },
  });
});

// ===== Recurring Issue Identification =====

router.get('/recurring-issues/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  // Find disagreements and resolutions from timeline
  const issues = db.prepare(
    `SELECT event_type, title, description, event_date, created_by, u.name AS created_by_name
     FROM timeline_events t
     JOIN users u ON u.id = t.created_by
     WHERE t.couple_id = ? AND t.event_type IN ('disagreement', 'resolution')
     ORDER BY t.event_date DESC LIMIT 100`
  ).all(req.params.coupleId);
  // Also analyze AI conversation analysis for conflict insights
  const conflicts = db.prepare(
    `SELECT analysis_type, result, created_at, u.name AS created_by_name
     FROM ai_conversation_analysis a
     JOIN users u ON u.id = a.created_by
     WHERE a.couple_id = ? AND a.analysis_type IN ('misunderstanding', 'pattern')
     ORDER BY a.created_at DESC LIMIT 50`
  ).all(req.params.coupleId).map(r => ({ ...r, result: r.result ? JSON.parse(r.result) : null }));
  return res.json({ recurring_issues: issues, conflict_insights: conflicts });
});

module.exports = router;
