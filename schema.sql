-- PostgreSQL Schema for Ben & Dragon! Character Sheet Database
-- Automatically created and managed by the Cloudflare Pages Functions / Backend

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  owner_id VARCHAR(255),
  owner_name VARCHAR(255),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_owner_id ON characters(owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_updated_at ON characters(updated_at);

-- Global App State (assignments, initiativeTracker, knownPlayers, global metadata)
CREATE TABLE IF NOT EXISTS app_state (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Roll History Table
CREATE TABLE IF NOT EXISTS roll_history (
  id VARCHAR(255) PRIMARY KEY,
  character_id VARCHAR(255),
  character_name VARCHAR(255),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roll_history_timestamp ON roll_history(timestamp DESC);
