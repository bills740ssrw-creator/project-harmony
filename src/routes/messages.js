'use strict';

const express = require('express');
const { z } = require('zod');
const { generateId } = require('../services/auth');
const { getDb } = require('../services/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authenticate);

// ---- File upload configuration ----
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${generateId()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  },
});

const sendSchema = z.object({
  couple_id: z.string().min(1),
  content: z.string().optional(),
  type: z.enum(['text', 'system', 'ai_mediation', 'ai_coaching', 'media']).optional().default('text'),
  media_type: z.enum(['image', 'video', 'voice', 'gif', 'sticker']).optional(),
  media_url: z.string().optional(),
  media_thumbnail: z.string().optional(),
  media_metadata: z.string().optional(),
  reply_to: z.string().optional(),
});

router.get('/:coupleId', (req, res) => {
  const db = getDb();
  const { limit = 100, before } = req.query;
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(404).json({ error: 'couple not found or access denied' });
  }
  let sql = `SELECT m.id, m.sender_id, m.content, m.type, m.media_type, m.media_url, m.media_thumbnail,
                    m.media_metadata, m.reply_to, m.edited_at, m.deleted_at, m.metadata, m.read_at, m.created_at,
                    u.name AS sender_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.couple_id = ? AND m.deleted_at IS NULL`;
  const params = [req.params.coupleId];
  if (before) {
    sql += ` AND m.created_at < ?`;
    params.push(before);
  }
  sql += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(parseInt(limit, 10));
  const rows = db.prepare(sql).all(...params).reverse();
  // Fetch reactions for all messages
  const messageIds = rows.map(m => m.id);
  const reactionsByMessage = {};
  if (messageIds.length > 0) {
    const placeholders = messageIds.map(() => '?').join(',');
    const reactionRows = db.prepare(
      `SELECT r.message_id, r.emoji, r.user_id, u.name AS user_name
       FROM message_reactions r
       JOIN users u ON u.id = r.user_id
       WHERE r.message_id IN (${placeholders})`
    ).all(...messageIds);
    for (const r of reactionRows) {
      if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = {};
      if (!reactionsByMessage[r.message_id][r.emoji]) reactionsByMessage[r.message_id][r.emoji] = [];
      reactionsByMessage[r.message_id][r.emoji].push({ user_id: r.user_id, user_name: r.user_name });
    }
  }
  const messages = rows.map(m => ({
    ...m,
    metadata: m.metadata ? JSON.parse(m.metadata) : null,
    media_metadata: m.media_metadata ? JSON.parse(m.media_metadata) : null,
    reactions: reactionsByMessage[m.id] || {},
  }));
  return res.json({ messages });
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no file uploaded' });
    }
    const { couple_id, media_type } = req.body;
    if (!couple_id || !media_type) {
      return res.status(400).json({ error: 'couple_id and media_type required' });
    }
    const db = getDb();
    const member = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const url = `/uploads/${req.file.filename}`;
    const mime = req.file.mimetype;
    let detectedMediaType = media_type;
    if (!detectedMediaType) {
      if (mime.startsWith('image/')) detectedMediaType = 'image';
      else if (mime.startsWith('video/')) detectedMediaType = 'video';
      else if (mime.startsWith('audio/')) detectedMediaType = 'voice';
    }
    const mediaMetadata = JSON.stringify({
      originalname: req.file.originalname,
      mimetype: mime,
      size: req.file.size,
      filename: req.file.filename,
    });
    return res.json({
      ok: true,
      url,
      media_type: detectedMediaType,
      media_metadata: mediaMetadata,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
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
    if (body.reply_to) {
      const replied = db.prepare(
        'SELECT id FROM messages WHERE id = ? AND couple_id = ?'
      ).get(body.reply_to, body.couple_id);
      if (!replied) {
        return res.status(400).json({ error: 'replied message not found in this couple' });
      }
    }
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, couple_id, sender_id, content, type, media_type, media_url, media_thumbnail, media_metadata, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id, body.couple_id, req.user.id, body.content || '', body.type,
      body.media_type || null, body.media_url || null, body.media_thumbnail || null,
      body.media_metadata || null, body.reply_to || null, now
    );
    const message = db.prepare(
      `SELECT m.id, m.sender_id, m.content, m.type, m.media_type, m.media_url, m.media_thumbnail,
                    m.media_metadata, m.reply_to, m.edited_at, m.deleted_at, m.metadata, m.read_at, m.created_at,
                    u.name AS sender_name
             FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
    ).get(id);
    message.media_metadata = message.media_metadata ? JSON.parse(message.media_metadata) : null;
    message.metadata = message.metadata ? JSON.parse(message.metadata) : null;
    return res.status(201).json({ message });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation failed', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.patch('/:messageId', (req, res) => {
  const db = getDb();
  const message = db.prepare('SELECT sender_id, couple_id, deleted_at FROM messages WHERE id = ?').get(req.params.messageId);
  if (!message) {
    return res.status(404).json({ error: 'message not found' });
  }
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ error: 'only sender can edit' });
  }
  if (message.deleted_at) {
    return res.status(400).json({ error: 'cannot edit deleted message' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(message.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content required' });
  }
  db.prepare(
    'UPDATE messages SET content = ?, edited_at = ? WHERE id = ?'
  ).run(content, new Date().toISOString(), req.params.messageId);
  const updated = db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.type, m.media_type, m.media_url, m.media_thumbnail,
                    m.media_metadata, m.reply_to, m.edited_at, m.deleted_at, m.metadata, m.read_at, m.created_at,
                    u.name AS sender_name
             FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
  ).get(req.params.messageId);
  updated.media_metadata = updated.media_metadata ? JSON.parse(updated.media_metadata) : null;
  updated.metadata = updated.metadata ? JSON.parse(updated.metadata) : null;
  return res.json({ message: updated });
});

router.delete('/:messageId', (req, res) => {
  const db = getDb();
  const message = db.prepare('SELECT sender_id, couple_id, deleted_at FROM messages WHERE id = ?').get(req.params.messageId);
  if (!message) {
    return res.status(404).json({ error: 'message not found' });
  }
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ error: 'only sender can delete' });
  }
  if (message.deleted_at) {
    return res.status(400).json({ error: 'message already deleted' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(message.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.messageId);
  return res.json({ ok: true, message: 'message deleted' });
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
  db.prepare(
    'INSERT OR REPLACE INTO message_read_receipts (id, message_id, user_id, read_at) VALUES (?, ?, ?, ?)'
  ).run(generateId(), req.params.messageId, req.user.id, new Date().toISOString());
  db.prepare('UPDATE messages SET read_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.messageId);
  return res.json({ ok: true });
});

router.post('/:messageId/reaction', (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'emoji required' });
    }
    const db = getDb();
    const message = db.prepare('SELECT couple_id FROM messages WHERE id = ? AND deleted_at IS NULL').get(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'message not found' });
    }
    const member = db.prepare(
      'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
    ).get(message.couple_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'access denied' });
    }
    const existing = db.prepare(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
    ).get(req.params.messageId, req.user.id, emoji);
    if (existing) {
      db.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
      return res.json({ ok: true, action: 'removed', emoji });
    } else {
      db.prepare(
        'INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(generateId(), req.params.messageId, req.user.id, emoji, new Date().toISOString());
      return res.json({ ok: true, action: 'added', emoji });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: String(err.message || err) });
  }
});

router.get('/search/:coupleId', (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'query required' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const like = `%${q}%`;
  const rows = db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.type, m.media_type, m.media_url, m.media_thumbnail,
                    m.reply_to, m.edited_at, m.deleted_at, m.created_at, u.name AS sender_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.couple_id = ? AND m.deleted_at IS NULL AND m.content LIKE ?
             ORDER BY m.created_at DESC LIMIT 50`
  ).all(req.params.coupleId, like);
  return res.json({ results: rows });
});

router.get('/media/:coupleId', (req, res) => {
  const db = getDb();
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(req.params.coupleId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const rows = db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.media_type, m.media_url, m.media_thumbnail,
                    m.media_metadata, m.created_at, u.name AS sender_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.couple_id = ? AND m.deleted_at IS NULL AND m.media_type IS NOT NULL
             ORDER BY m.created_at DESC`
  ).all(req.params.coupleId);
  const media = rows.map(m => ({
    ...m,
    media_metadata: m.media_metadata ? JSON.parse(m.media_metadata) : null,
  }));
  return res.json({ media });
});

router.get('/:messageId/reactions', (req, res) => {
  const db = getDb();
  const message = db.prepare('SELECT couple_id FROM messages WHERE id = ?').get(req.params.messageId);
  if (!message) {
    return res.status(404).json({ error: 'message not found' });
  }
  const member = db.prepare(
    'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
  ).get(message.couple_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'access denied' });
  }
  const rows = db.prepare(
    `SELECT r.emoji, r.created_at, u.name AS user_name
     FROM message_reactions r
     JOIN users u ON u.id = r.user_id
     WHERE r.message_id = ?`
  ).all(req.params.messageId);
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push({ user_id: r.user_id, user_name: r.user_name, created_at: r.created_at });
  }
  return res.json({ reactions: grouped });
});

module.exports = router;
