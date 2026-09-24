-- Cloudflare D1 Migration for Ben & Dragon! (bendragonDB)
-- Character Sheet Database

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  owner_id TEXT,
  owner_name TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_characters_owner_id ON characters(owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_updated_at ON characters(updated_at);

-- Global App State (assignments, initiativeTracker, knownPlayers, global metadata)
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Roll History Table
CREATE TABLE IF NOT EXISTS roll_history (
  id TEXT PRIMARY KEY,
  character_id TEXT,
  character_name TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roll_history_timestamp ON roll_history(timestamp DESC);
