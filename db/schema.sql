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
  type TEXT NOT NULL DEFAULT 'text', -- text, system, ai_mediation, ai_coaching, media
  media_type TEXT, -- image, video, voice, gif, sticker
  media_url TEXT,
  media_thumbnail TEXT,
  media_metadata TEXT, -- JSON: dimensions, duration, size
  reply_to TEXT, -- message id being replied to
  edited_at TEXT,
  deleted_at TEXT, -- soft delete
  metadata TEXT, -- JSON
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_couple ON messages(couple_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);

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

-- Message reactions (emoji reactions on messages)
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);

-- User online presence
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline', -- online, offline, away
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  socket_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI participation consent per couple (both partners must consent)
CREATE TABLE IF NOT EXISTS ai_consent (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consented INTEGER NOT NULL DEFAULT 0, -- 0 = no, 1 = yes
  consented_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(couple_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_consent_couple ON ai_consent(couple_id);

-- Shared AI conversation analysis records (transparent to both partners)
CREATE TABLE IF NOT EXISTS ai_conversation_analysis (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  message_id TEXT,
  analysis_type TEXT NOT NULL, -- pattern, misunderstanding, summary, insight, reply_suggestion
  result TEXT, -- JSON
  created_by TEXT NOT NULL, -- user who triggered
  visible_to_both INTEGER NOT NULL DEFAULT 1, -- always 1 for shared analysis
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_analysis_couple ON ai_conversation_analysis(couple_id);

-- Private AI coaching records (owner-only unless explicitly shared)
CREATE TABLE IF NOT EXISTS ai_private_coaching (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  couple_id TEXT,
  message_content TEXT,
  coaching_result TEXT, -- JSON
  shared_with_couple INTEGER NOT NULL DEFAULT 0, -- 0 = private, 1 = shared
  shared_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_private_coaching_user ON ai_private_coaching(user_id);

-- ===== MODULE E: Relationship Intelligence & Memory =====

-- Relationship health snapshots (track improvement over time)
CREATE TABLE IF NOT EXISTS relationship_health (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL, -- 0-100
  communication_score INTEGER,
  conflict_resolution_score INTEGER,
  intimacy_score INTEGER,
  trust_score INTEGER,
  goals_score INTEGER,
  factors TEXT, -- JSON breakdown of factors
  note TEXT,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_health_couple ON relationship_health(couple_id, created_at);

-- Relationship timeline events (shared memories)
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- milestone, disagreement, resolution, memory, goal, commitment, insight
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  metadata TEXT, -- JSON
  created_by TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1, -- 1 = visible to both, 0 = private to creator
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_couple ON timeline_events(couple_id, event_date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_type ON timeline_events(event_type);

-- Memory corrections/deletions (audit trail for shared memory edits)
CREATE TABLE IF NOT EXISTS memory_corrections (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  original_type TEXT NOT NULL, -- timeline_event, message, commitment, goal
  original_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  corrected_by TEXT NOT NULL,
  corrected_at TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_corrections_couple ON memory_corrections(couple_id);

-- ===== MODULE F: Growth System =====

-- Daily check-ins (mood, gratitude, connection)
CREATE TABLE IF NOT EXISTS daily_checkins (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL, -- YYYY-MM-DD
  mood_score INTEGER, -- 1-10
  connection_score INTEGER, -- 1-10
  communication_score INTEGER, -- 1-10
  gratitude_note TEXT,
  concern_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(couple_id, user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_couple_date ON daily_checkins(couple_id, checkin_date);

-- Weekly relationship exercises
CREATE TABLE IF NOT EXISTS weekly_exercises (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  exercise_type TEXT NOT NULL, -- communication, intimacy, conflict, gratitude, trust
  assigned_date TEXT NOT NULL,
  due_date TEXT,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, skipped
  completed_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_weekly_exercises_couple ON weekly_exercises(couple_id, status);
CREATE INDEX IF NOT EXISTS idx_weekly_exercises_due ON weekly_exercises(due_date);

-- 30-day improvement programmes
CREATE TABLE IF NOT EXISTS improvement_programmes (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  focus_area TEXT NOT NULL, -- communication, conflict, intimacy, trust, goals
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused, abandoned
  completion_percentage INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_improvement_programmes_couple ON improvement_programmes(couple_id, status);

-- Programme daily tasks
CREATE TABLE IF NOT EXISTS programme_tasks (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL,
  day_number INTEGER NOT NULL, -- 1-30
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- reflection, conversation, exercise, checkin
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, skipped
  FOREIGN KEY (programme_id) REFERENCES improvement_programmes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_programme_tasks_programme ON programme_tasks(programme_id, day_number);

-- Individual improvement goals (private to each partner)
CREATE TABLE IF NOT EXISTS individual_goals (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL, -- communication, listening, patience, empathy, etc.
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused, abandoned
  progress_percentage INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_individual_goals_user ON individual_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_individual_goals_couple ON individual_goals(couple_id);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  remind_at TEXT NOT NULL,
  reminder_type TEXT NOT NULL, -- commitment, goal, checkin, exercise, custom
  is_sent INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_couple ON reminders(couple_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON reminders(is_sent);
