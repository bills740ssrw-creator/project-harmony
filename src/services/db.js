'use strict';

const SQL = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let SQLLib = null;
let db = null;
let persistTimer = null;

async function initDb() {
  SQLLib = await SQL();
  const p = config.dbPath;
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let existing = null;
  if (fs.existsSync(p)) {
    existing = fs.readFileSync(p);
  }
  db = new SQLLib.Database(existing);
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  db.exec(schema);
  startPersistLoop();
  return db;
}

function getDb() {
  if (!db) throw new Error('database not initialized');
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return (sql) => ({
          get: (...params) => {
            const results = db.exec(sql, params);
            if (!results || results.length === 0 || !results[0].values.length) return null;
            return toObjects(results[0])[0];
          },
          all: (...params) => {
            const results = db.exec(sql, params);
            if (!results || results.length === 0) return [];
            return toObjects(results[0]);
          },
          run: (...params) => {
            const stmt = db.prepare(sql);
            const info = stmt.run(params);
            stmt.free();
            return info;
          },
          free: () => {},
        });
      }
      if (prop === 'transaction') {
        return (fn) => {
          return (...args) => {
            db.exec('BEGIN');
            try {
              const result = fn(...args);
              db.exec('COMMIT');
              return result;
            } catch (err) {
              try { db.exec('ROLLBACK'); } catch (e) {}
              throw err;
            }
          };
        };
      }
      return target[prop];
    },
  });
}

function persist() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(config.dbPath, Buffer.from(data));
  } catch (err) {
    console.error('persist error:', err.message);
  }
}

function startPersistLoop() {
  if (persistTimer) clearInterval(persistTimer);
  persistTimer = setInterval(persist, 5000);
  if (persistTimer.unref) persistTimer.unref();
  const flush = () => persist();
  process.on('exit', flush);
  process.on('SIGINT', () => { flush(); process.exit(0); });
  process.on('SIGTERM', () => { flush(); process.exit(0); });
}

function toObjects(result) {
  const { columns, values } = result;
  return values.map((v) =>
    Object.fromEntries(columns.map((c, i) => [c, v[i]]))
  );
}

function queryAll(sql, params = []) {
  const results = db.exec(sql, params);
  if (!results || results.length === 0) return [];
  return toObjects(results[0]);
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(params);
  stmt.free();
  return info;
}

module.exports = { initDb, getDb, persist, queryAll, queryOne, run };
