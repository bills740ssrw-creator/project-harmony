'use strict';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');
const config = require('../config');

let wss = null;
const clients = new Map(); // ws -> { userId, coupleId }

function authenticateWs(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return null;
  }
}

function broadcastToCouple(coupleId, payload) {
  const message = JSON.stringify(payload);
  for (const [ws, info] of clients) {
    if (info.coupleId === coupleId && ws.readyState === 1) {
      ws.send(message);
    }
  }
}

function startWsServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const payload = authenticateWs(token);
    if (!payload) {
      ws.close(1008, 'auth required');
      return;
    }
    const userId = payload.sub;
    clients.set(ws, { userId });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return;
      }
      const { type } = data || {};
      const info = clients.get(ws) || {};

      if (type === 'join') {
        const coupleId = data.couple_id;
        if (!coupleId) return;
        const db = getDb();
        const member = db.prepare(
          'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
        ).get(coupleId, userId);
        if (!member) {
          ws.send(JSON.stringify({ type: 'error', error: 'access denied' }));
          return;
        }
        info.coupleId = coupleId;
        clients.set(ws, info);
        ws.send(JSON.stringify({ type: 'joined', couple_id: coupleId }));
      }

      if (type === 'message') {
        const coupleId = info.coupleId || data.couple_id;
        if (!coupleId) return;
        const db = getDb();
        const member = db.prepare(
          'SELECT 1 FROM couple_members WHERE couple_id = ? AND user_id = ? AND is_active = 1'
        ).get(coupleId, userId);
        if (!member) return;
        const id = require('crypto').randomUUID();
        const now = new Date().toISOString();
        db.prepare(
          'INSERT INTO messages (id, couple_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, coupleId, userId, data.content, 'text', now);
        const message = {
          id,
          sender_id: userId,
          content: data.content,
          type: 'text',
          created_at: now,
        };
        broadcastToCouple(coupleId, { type: 'message', couple_id: coupleId, message });
      }

      if (type === 'typing') {
        const coupleId = info.coupleId || data.couple_id;
        if (!coupleId) return;
        broadcastToCouple(coupleId, {
          type: 'typing',
          couple_id: coupleId,
          user_id: userId,
          user_name: data.user_name,
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });
}

module.exports = { startWsServer, broadcastToCouple };
