'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const {
  mediate, coach, insight, translate,
  analyzePattern, identifyMisunderstanding, suggestReply, summarizeConversation,
} = require('../services/ai');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ---- Helper: check AI consent for a couple ----
function getLanguage(db, coupleId, userId) {
  const member = db.prepare(
    'SELECT u.language FROM couple_members cm JOIN users u ON u.id = cm.user_id WHERE cm.couple_id = ? AND cm.user_id = ? AND cm.is_active = 1'
  ).get(coupleId, userId);
  return member ? (member.language || 'en') : 'en';
}

function verifyCoupleMembership(db, coupleId, userId) {
  return db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(coupleId, userId);
}

function checkBothConsent(db, coupleId) {
  const consents = db.prepare(
    'SELECT user_id, consented FROM ai_consent WHERE couple_id = ?'
  ).all(coupleId);
  const memberIds = db.prepare(
    'SELECT user_id FROM couple_members WHERE couple_id = ? AND is_active = 1'
  ).all(coupleId).map(m => m.user_id);
  const consentMap = {};
  for (const c of consents) consentMap[c.user_id] = c.consented === 1;
  const allConsented = memberIds.every(id => consentMap[id] === true);
  return { allConsented, consentMap, memberIds };
}

const mediateSchema = z.object({
  couple_id: z.string().min(1),
  conversation: z.string().min(1),
});

const coachSchema = z.object({
  couple_id: z.string().optional(),
  message: z.string().min(1),
  private: z.boolean().optional().default(true),
});

const insightSchema = z.object({
  couple_id: z.string().min(1),
});

const translateSchema = z.object({
  text: z.string().min(1),
  target_language: z.string().length(2).default('en'),
});

const analysisSchema = z.object({
  couple_id: z.string().min(1),
  conversation: z.string().min(1),
  analysis_type: z.enum(['pattern', 'misunderstanding', 'reply_suggestion', 'summary']),
});

const consentSchema = z.object({
  couple_id: z.string().min(1),
  consented: z.boolean(),
});

// ===== AI Consent Management =====

router.get('/consent/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyCoupleMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { allConsented, consentMap, memberIds } = checkBothConsent(db, req.params.coupleId);
  return res.json({
    couple_id: req.params.coupleId,
    both_consented: allConsented,
    my_consent: consentMap[req.user.id] === true,
    partner_consents: consentMap,
  });
});

router.post('/consent', (req, res) => {
  try {
    const body = consentSchema.parse(req.body);
    const db = getDb();
    const member = verifyCoupleMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const now = new Date().toISOString();
    const existing = db.prepare(
      'SELECT id FROM ai_consent WHERE couple_id = ? AND user_id = ?'
    ).get(body.couple_id, req.user.id);
    if (existing) {
      db.prepare(
        'UPDATE ai_consent SET consented = ?, consented_at = ?, updated_at = ? WHERE id = ?'
      ).run(body.consented ? 1 : 0, body.consented ? now : null, now, existing.id);
    } else {
      db.prepare(
        'INSERT INTO ai_consent (id, couple_id, user_id, consented, consented_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(generateId(), body.couple_id, req.user.id, body.consented ? 1 : 0, body.consented ? now : null, now);
    }
    const { allConsented } = checkBothConsent(db, body.couple_id);
    return res.json({
      ok: true,
      consented: body.consented,
      both_consented: allConsented,
      message: body.consented ? 'AI participation enabled for you' : 'AI participation disabled for you',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Mediation (shared, requires both consent) =====

router.post('/mediate', async (req, res) => {
  try {
    const body = mediateSchema.parse(req.body);
    const db = getDb();
    const member = verifyCoupleMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const { allConsented } = checkBothConsent(db, body.couple_id);
    if (!allConsented) {
      return res.status(403).json({ error: 'AI mediation requires both partners to consent' });
    }
    const language = getLanguage(db, body.couple_id, req.user.id);
    const result = await mediate({
      conversation: body.conversation,
      language,
      coupleContext: { coupleId: body.couple_id, userId: req.user.id },
    });
    const sessionId = generateId();
    db.prepare(
      'INSERT INTO ai_sessions (id, couple_id, user_id, type, title, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, body.couple_id, req.user.id, 'mediation', 'Mediation session', JSON.stringify({ conversation: body.conversation }), new Date().toISOString());
    db.prepare(
      'INSERT INTO ai_conversation_analysis (id, couple_id, message_id, analysis_type, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(generateId(), body.couple_id, null, 'mediation', JSON.stringify({ reply: result.reply }), req.user.id, new Date().toISOString());
    return res.json({ ...result, sessionId, shared: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Coaching (private unless shared) =====

router.post('/coach', async (req, res) => {
  try {
    const body = coachSchema.parse(req.body);
    let language = 'en';
    let coupleId = null;
    if (body.couple_id) {
      const db = getDb();
      const member = verifyCoupleMembership(db, body.couple_id, req.user.id);
      if (!member) {
        return res.status(403).json({ error: 'access denied' });
      }
      language = getLanguage(db, body.couple_id, req.user.id);
      coupleId = body.couple_id;
    }
    const result = await coach({
      message: body.message,
      language,
      coupleContext: { coupleId, userId: req.user.id },
    });
    if (coupleId) {
      const db = getDb();
      db.prepare(
        'INSERT INTO ai_private_coaching (id, user_id, couple_id, message_content, coaching_result, shared_with_couple, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
      ).run(generateId(), req.user.id, coupleId, body.message, JSON.stringify({ reply: result.reply }), new Date().toISOString());
    }
    return res.json({ ...result, private: body.private !== false });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Insight (shared, requires both consent) =====

router.post('/insight', async (req, res) => {
  try {
    const body = insightSchema.parse(req.body);
    const db = getDb();
    const member = verifyCoupleMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const { allConsented } = checkBothConsent(db, body.couple_id);
    if (!allConsented) {
      return res.status(403).json({ error: 'AI insight requires both partners to consent' });
    }
    const language = getLanguage(db, body.couple_id, req.user.id);
    const recent = db.prepare(
      'SELECT m.sender_id, m.content, m.created_at, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.couple_id = ? ORDER BY m.created_at DESC LIMIT 30'
    ).all(body.couple_id);
    const goals = db.prepare('SELECT * FROM goals WHERE couple_id = ? ORDER BY created_at DESC LIMIT 10').all(body.couple_id);
    const result = await insight({
      coupleId: body.couple_id,
      recentMessages: recent.reverse(),
      goals,
      language,
    });
    const sessionId = generateId();
    db.prepare(
      'INSERT INTO ai_sessions (id, couple_id, user_id, type, title, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, body.couple_id, req.user.id, 'insight', 'Relationship insight', JSON.stringify({ recent, goals }), new Date().toISOString());
    db.prepare(
      'INSERT INTO ai_conversation_analysis (id, couple_id, message_id, analysis_type, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(generateId(), body.couple_id, null, 'insight', JSON.stringify({ reply: result.reply }), req.user.id, new Date().toISOString());
    return res.json({ ...result, sessionId, shared: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Translation =====

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

// ===== Conversation Analysis (shared, requires both consent) =====

router.post('/analyze', async (req, res) => {
  try {
    const body = analysisSchema.parse(req.body);
    const db = getDb();
    const member = verifyCoupleMembership(db, body.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const { allConsented } = checkBothConsent(db, body.couple_id);
    if (!allConsented) {
      return res.status(403).json({ error: 'AI analysis requires both partners to consent' });
    }
    const language = getLanguage(db, body.couple_id, req.user.id);
    let result;
    if (body.analysis_type === 'pattern') {
      result = await analyzePattern({ conversation: body.conversation, language, coupleContext: { coupleId: body.couple_id, userId: req.user.id } });
    } else if (body.analysis_type === 'misunderstanding') {
      result = await identifyMisunderstanding({ conversation: body.conversation, language, coupleContext: { coupleId: body.couple_id, userId: req.user.id } });
    } else if (body.analysis_type === 'reply_suggestion') {
      result = await suggestReply({ conversation: body.conversation, language, coupleContext: { coupleId: body.couple_id, userId: req.user.id } });
    } else if (body.analysis_type === 'summary') {
      result = await summarizeConversation({ conversation: body.conversation, language, coupleContext: { coupleId: body.couple_id, userId: req.user.id } });
    }
    db.prepare(
      'INSERT INTO ai_conversation_analysis (id, couple_id, message_id, analysis_type, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(generateId(), body.couple_id, null, body.analysis_type, JSON.stringify({ reply: result.reply }), req.user.id, new Date().toISOString());
    return res.json({ ...result, analysis_type: body.analysis_type, shared: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

// ===== Shared analysis history =====

router.get('/analysis/:coupleId', (req, res) => {
  const db = getDb();
  const member = verifyCoupleMembership(db, req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const rows = db.prepare(
    `SELECT a.id, a.analysis_type, a.result, a.created_by, a.created_at, u.name AS created_by_name
     FROM ai_conversation_analysis a
     JOIN users u ON u.id = a.created_by
     WHERE a.couple_id = ? AND a.visible_to_both = 1
     ORDER BY a.created_at DESC LIMIT 50`
  ).all(req.params.coupleId);
  const history = rows.map(r => ({ ...r, result: r.result ? JSON.parse(r.result) : null }));
  return res.json({ analysis: history });
});

// ===== Private coaching (owner only) =====

router.get('/coaching/private', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, couple_id, message_content, coaching_result, shared_with_couple, shared_at, created_at
     FROM ai_private_coaching
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`
  ).all(req.user.id);
  const coaching = rows.map(r => ({
    ...r,
    coaching_result: r.coaching_result ? JSON.parse(r.coaching_result) : null,
    is_private: r.shared_with_couple !== 1,
  }));
  return res.json({ coaching });
});

module.exports = router;
