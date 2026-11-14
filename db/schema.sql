-- Project Harmony database schema
-- SQLite (better-sqlite3), WAL mode, foreign keys ON

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  country TEXT DEFAULT 'US',
  language TEXT DEFAULT 'en',
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Couples (a relationship between two users)
CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, archived
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')) 
);

-- Couple membership (many users can belong to a couple, typically 2)
CREATE TABLE IF NOT EXISTS couple_members (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'partner', -- partner, admin
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(couple_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_couple_members_user ON couple_members(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_members_couple ON couple_members(couple_id);

-- Messages between couple members
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- text, system, ai_mediation, ai_coaching
  metadata TEXT, -- JSON
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_couple ON messages(couple_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Relationship goals (shared by a couple)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused, abandoned
  target_date TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_couple ON goals(couple_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Commitments (actionable promises tied to goals or standalone)
CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  goal_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL, -- user who owns/commits to this
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, overdue, cancelled
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_commitments_couple ON commitments(couple_id);
CREATE INDEX IF NOT EXISTS idx_commitments_owner ON commitments(owner_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status);

-- AI coaching / mediation sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'coaching', -- coaching, mediation, insight, translation
  title TEXT,
  context TEXT, -- JSON input context
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_couple ON ai_sessions(couple_id);

-- AI insights / responses generated during a session
CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  couple_id TEXT NOT NULL,
  category TEXT NOT NULL, -- communication, conflict, perspective, habit, goal
  insight TEXT NOT NULL,
  severity TEXT DEFAULT 'info', -- info, warning, critical
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_couple ON ai_insights(couple_id);

-- Relationship health snapshots (for analytics / tracking improvement)
CREATE TABLE IF NOT EXISTS health_snapshots (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  score INTEGER NOT NULL, -- 0-100
  factors TEXT, -- JSON breakdown
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_couple ON health_snapshots(couple_id, created_at);

-- App configuration / branding (key-value)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Secure invitation tokens for couple connections
CREATE TABLE IF NOT EXISTS invitation_tokens (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  inviter_id TEXT NOT NULL,
  email TEXT NOT NULL, -- intended recipient email
  expires_at TEXT NOT NULL,
  used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_token ON invitation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_couple ON invitation_tokens(couple_id);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- User sessions (for session management / audit)
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
