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

const checkinSchema = z.object({
  couple_id: z.string().min(1),
  checkin_date: z.string().min(1),
  mood_score: z.number().min(1).max(10).optional(),
  connection_score: z.number().min(1).max(10).optional(),
  communication_score: z.number().min(1).max(10).optional(),
  gratitude_note: z.string().optional(),
  concern_note: z.string().optional(),
});

const exerciseSchema = z.object({
  couple_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  exercise_type: z.enum(['communication', 'intimacy', 'conflict', 'gratitude', 'trust']),
  assigned_date: z.string().min(1),
  due_date: z.string().optional(),
  notes: z.string().optional(),
});

const programmeSchema = z.object({
  couple_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  focus_area: z.enum(['communication', 'conflict', 'intimacy', 'trust', 'goals']),
  start_date: z.string().min(1),
  end_date: z.string().optional(),
});

const individualGoalSchema = z.object({
  couple_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  goal_type: z.string().min(1),
  target_date: z.string().optional(),
});

const reminderSchema = z.object({
  couple_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  remind_at: z.string().min(1),
  reminder_type: z.enum(['commitment', 'goal', 'checkin', 'exercise', 'custom']),
});

// ===== Daily Check-ins =====

router.get('/checkins/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { from, to } = req.query;
  let sql = `SELECT c.*, u.name AS user_name
             FROM daily_checkins c
             JOIN users u ON u.id = c.user_id
             WHERE c.couple_id = ?`;
  const params = [req.params.coupleId];
  if (from) { sql += ` AND c.checkin_date >= ?`; params.push(from); }
  if (to) { sql += ` AND c.checkin_date <= ?`; params.push(to); }
  sql += ` ORDER BY c.checkin_date DESC, c.user_id`;
  const rows = db.prepare(sql).all(...params);
  return res.json({ checkins: rows });
});

router.post('/checkins', (req, res) => {
  try {
    const body = checkinSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO daily_checkins (id, couple_id, user_id, checkin_date, mood_score, connection_score, communication_score, gratitude_note, concern_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, req.user.id, body.checkin_date, body.mood_score || null,
      body.connection_score || null, body.communication_score || null,
      body.gratitude_note || null, body.concern_note || null, now);
    const checkin = db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(id);
    return res.status(201).json({ checkin });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Weekly Exercises =====

router.get('/exercises/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { status } = req.query;
  let sql = `SELECT e.*, u.name AS completed_by_name
             FROM weekly_exercises e
             LEFT JOIN users u ON u.id = e.completed_by
             WHERE e.couple_id = ?`;
  const params = [req.params.coupleId];
  if (status) { sql += ` AND e.status = ?`; params.push(status); }
  sql += ` ORDER BY e.due_date ASC, e.assigned_date DESC`;
  return res.json({ exercises: db.prepare(sql).all(...params) });
});

router.post('/exercises', (req, res) => {
  try {
    const body = exerciseSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO weekly_exercises (id, couple_id, title, description, exercise_type, assigned_date, due_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, body.title, body.description || null, body.exercise_type,
      body.assigned_date, body.due_date || null, 'pending', body.notes || null, now);
    const exercise = db.prepare('SELECT * FROM weekly_exercises WHERE id = ?').get(id);
    return res.status(201).json({ exercise });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/exercises/:exerciseId', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM weekly_exercises WHERE id = ?').get(req.params.exerciseId);
  if (!exercise) {
    return res.status(404).json({ error: 'exercise not found' });
  }
  const member = verifyMembership(db, exercise.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const fields = [];
  const params = [];
  if ('status' in req.body) {
    fields.push('status = ?');
    params.push(req.body.status);
    if (req.body.status === 'completed') {
      fields.push('completed_at = ?');
      params.push(new Date().toISOString());
      fields.push('completed_by = ?');
      params.push(req.user.id);
    }
  }
  if ('notes' in req.body) {
    fields.push('notes = ?');
    params.push(req.body.notes);
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  params.push(req.params.exerciseId);
  db.prepare(`UPDATE weekly_exercises SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM weekly_exercises WHERE id = ?').get(req.params.exerciseId);
  return res.json({ exercise: updated });
});

// ===== Improvement Programmes (30-day) =====

router.get('/programmes/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { status } = req.query;
  let sql = `SELECT p.*, u.name AS created_by_name
             FROM improvement_programmes p
             JOIN users u ON u.id = p.created_by
             WHERE p.couple_id = ?`;
  const params = [req.params.coupleId];
  if (status) { sql += ` AND p.status = ?`; params.push(status); }
  sql += ` ORDER BY p.created_at DESC`;
  return res.json({ programmes: db.prepare(sql).all(...params) });
});

router.post('/programmes', (req, res) => {
  try {
    const body = programmeSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    const endDate = body.end_date || null;
    db.prepare(
      'INSERT INTO improvement_programmes (id, couple_id, title, description, focus_area, start_date, end_date, status, completion_percentage, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(id, body.couple_id, body.title, body.description || null, body.focus_area,
      body.start_date, endDate, 'active', req.user.id, now);
    // Generate 30 daily tasks
    const start = new Date(body.start_date);
    for (let day = 1; day <= 30; day++) {
      const taskDate = new Date(start);
      taskDate.setDate(start.getDate() + (day - 1));
      const taskId = generateId();
      db.prepare(
        'INSERT INTO programme_tasks (id, programme_id, day_number, title, description, task_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(taskId, id, day, `Day ${day} task`, `Focus on ${body.focus_area} - day ${day}`,
        day % 7 === 0 ? 'reflection' : 'conversation', 'pending');
    }
    const programme = db.prepare('SELECT * FROM improvement_programmes WHERE id = ?').get(id);
    return res.status(201).json({ programme });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.get('/programmes/:programmeId/tasks', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT p.couple_id FROM improvement_programmes p WHERE p.id = ?').get(req.params.programmeId);
  if (!task) {
    return res.status(404).json({ error: 'programme not found' });
  }
  const member = verifyMembership(db, task.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const tasks = db.prepare(
    'SELECT * FROM programme_tasks WHERE programme_id = ? ORDER BY day_number ASC'
  ).all(req.params.programmeId);
  return res.json({ tasks });
});

router.patch('/programmes/:programmeId/tasks/:taskId', (req, res) => {
  const db = getDb();
  const task = db.prepare(
    `SELECT t.*, p.couple_id FROM programme_tasks t
     JOIN improvement_programmes p ON p.id = t.programme_id
     WHERE t.id = ?`
  ).get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'task not found' });
  }
  const member = verifyMembership(db, task.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { status } = req.body;
  if (!status || !['pending', 'completed', 'skipped'].includes(status)) {
    return res.status(400).json({ error: 'valid status required' });
  }
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE programme_tasks SET status = ?, completed_at = ? WHERE id = ?'
  ).run(status, status === 'completed' ? now : null, req.params.taskId);
  // Recompute programme completion
  const all = db.prepare('SELECT status FROM programme_tasks WHERE programme_id = ?').all(req.params.programmeId);
  const completed = all.filter(t => t.status === 'completed').length;
  const pct = all.length > 0 ? Math.round((completed / all.length) * 100) : 0;
  const progStatus = pct === 100 ? 'completed' : 'active';
  db.prepare(
    'UPDATE improvement_programmes SET completion_percentage = ?, status = ? WHERE id = ?'
  ).run(pct, progStatus, req.params.programmeId);
  return res.json({ ok: true, completion_percentage: pct, programme_status: progStatus });
});

// ===== Individual Improvement Goals (private per partner) =====

router.get('/individual-goals/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  // Return all individual goals for the couple (partners can see each other's goals but not private notes)
  const rows = db.prepare(
    `SELECT g.*, u.name AS user_name
     FROM individual_goals g
     JOIN users u ON u.id = g.user_id
     WHERE g.couple_id = ?
     ORDER BY g.created_at DESC`
  ).all(req.params.coupleId);
  return res.json({ individual_goals: rows });
});

router.post('/individual-goals', (req, res) => {
  try {
    const body = individualGoalSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO individual_goals (id, couple_id, user_id, title, description, goal_type, target_date, status, progress_percentage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, body.couple_id, req.user.id, body.title, body.description || null,
      body.goal_type, body.target_date || null, 'active', 0, now, now);
    const goal = db.prepare('SELECT * FROM individual_goals WHERE id = ?').get(id);
    return res.status(201).json({ individual_goal: goal });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/individual-goals/:goalId', (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM individual_goals WHERE id = ?').get(req.params.goalId);
  if (!goal) {
    return res.status(404).json({ error: 'individual goal not found' });
  }
  const member = verifyMembership(db, goal.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  // Only the owner can update progress/status
  const fields = [];
  const params = [];
  for (const key of ['title', 'description', 'goal_type', 'target_date']) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if ('progress_percentage' in req.body) {
    fields.push('progress_percentage = ?');
    params.push(Math.min(100, Math.max(0, req.body.progress_percentage)));
  }
  if ('status' in req.body) {
    fields.push('status = ?');
    params.push(req.body.status);
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), req.params.goalId);
  db.prepare(`UPDATE individual_goals SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM individual_goals WHERE id = ?').get(req.params.goalId);
  return res.json({ individual_goal: updated });
});

// ===== Reminders =====

router.get('/reminders/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { include_sent = 'false' } = req.query;
  let sql = `SELECT r.*, u.name AS user_name
             FROM reminders r
             JOIN users u ON u.id = r.user_id
             WHERE r.couple_id = ?`;
  const params = [req.params.coupleId];
  if (include_sent !== 'true') {
    sql += ` AND r.is_sent = 0`;
  }
  sql += ` ORDER BY r.remind_at ASC`;
  return res.json({ reminders: db.prepare(sql).all(...params) });
});

router.post('/reminders', (req, res) => {
  try {
    const body = reminderSchema.parse(req.body);
    const db = getDb();
    const member = verifyMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO reminders (id, couple_id, user_id, title, description, remind_at, reminder_type, is_sent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(id, body.couple_id, req.user.id, body.title, body.description || null,
      body.remind_at, body.reminder_type, now);
    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    return res.status(201).json({ reminder });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/reminders/:reminderId/sent', (req, res) => {
  const db = getDb();
  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.reminderId);
  if (!reminder) {
    return res.status(404).json({ error: 'reminder not found' });
  }
  const member = verifyMembership(db, reminder.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  db.prepare(
    'UPDATE reminders SET is_sent = 1, sent_at = ? WHERE id = ?'
  ).run(new Date().toISOString(), req.params.reminderId);
  return res.json({ ok: true });
});

// ===== Weekly Progress Report =====

router.get('/weekly-report/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { from, to } = req.query;
  const end = to || new Date().toISOString().split('T')[0];
  const start = from || (() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();
  // Check-ins in period
  const checkins = db.prepare(
    `SELECT * FROM daily_checkins WHERE couple_id = ? AND checkin_date BETWEEN ? AND ? ORDER BY checkin_date DESC`
  ).all(req.params.coupleId, start, end);
  // Exercises completed
  const exercisesCompleted = db.prepare(
    `SELECT COUNT(*) AS cnt FROM weekly_exercises WHERE couple_id = ? AND status = 'completed' AND completed_at BETWEEN ? AND ?`
  ).get(req.params.coupleId, start, end).cnt;
  // Commitments completed
  const commitmentsCompleted = db.prepare(
    `SELECT COUNT(*) AS cnt FROM commitments WHERE couple_id = ? AND status = 'completed' AND updated_at BETWEEN ? AND ?`
  ).get(req.params.coupleId, start, end).cnt;
  // Goals completed
  const goalsCompleted = db.prepare(
    `SELECT COUNT(*) AS cnt FROM goals WHERE couple_id = ? AND status = 'completed' AND updated_at BETWEEN ? AND ?`
  ).get(req.params.coupleId, start, end).cnt;
  // Health snapshots
  const health = db.prepare(
    `SELECT * FROM relationship_health WHERE couple_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC`
  ).all(req.params.coupleId, start, end);
  // Average mood
  const moodRows = checkins.filter(c => c.mood_score);
  const avgMood = moodRows.length > 0
    ? Math.round((moodRows.reduce((s, c) => s + c.mood_score, 0) / moodRows.length) * 10) / 10
    : null;
  const latestHealth = health[0];
  return res.json({
    weekly_report: {
      period: { start, end },
      checkins: { count: checkins.length, avg_mood: avgMood, entries: checkins },
      exercises_completed: exercisesCompleted,
      commitments_completed: commitmentsCompleted,
      goals_completed: goalsCompleted,
      latest_health_score: latestHealth ? latestHealth.overall_score : null,
      health_trend: health.map(h => ({ date: h.created_at, score: h.overall_score })),
    },
  });
});

// ===== Overall Progress =====

router.get('/progress/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const commitments = db.prepare(
    'SELECT status, COUNT(*) AS cnt FROM commitments WHERE couple_id = ? GROUP BY status'
  ).all(req.params.coupleId);
  const goals = db.prepare(
    'SELECT status, COUNT(*) AS cnt FROM goals WHERE couple_id = ? GROUP BY status'
  ).all(req.params.coupleId);
  const programmes = db.prepare(
    'SELECT status, COUNT(*) AS cnt, AVG(completion_percentage) AS avg_pct FROM improvement_programmes WHERE couple_id = ? GROUP BY status'
  ).all(req.params.coupleId);
  const individualGoals = db.prepare(
    'SELECT status, COUNT(*) AS cnt, AVG(progress_percentage) AS avg_pct FROM individual_goals WHERE couple_id = ? GROUP BY status'
  ).all(req.params.coupleId);
  const latestHealth = db.prepare(
    'SELECT overall_score FROM relationship_health WHERE couple_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(req.params.coupleId);
  const recentCheckins = db.prepare(
    `SELECT mood_score, connection_score, communication_score FROM daily_checkins
     WHERE couple_id = ? ORDER BY checkin_date DESC LIMIT 14`
  ).all(req.params.coupleId);
  return res.json({
    progress: {
      commitments,
      goals,
      programmes,
      individual_goals: individualGoals,
      latest_health_score: latestHealth ? latestHealth.overall_score : null,
      recent_checkins: recentCheckins,
    },
  });
});

module.exports = router;
