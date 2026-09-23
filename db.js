import { Pool } from 'pg';
import { neon, Pool as NeonPool } from '@neondatabase/serverless';

// Cache client pools across warm worker / server invocations
const poolCache = new Map();
let schemaInitialized = false;

/**
 * Resolves the connection string from environment variables or custom configuration
 */
export function getConnectionString(env = {}) {
  // Check Cloudflare Hyperdrive binding first if available
  if (env?.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }

  // Check explicit environment variables
  const url =
    env?.DATABASE_URL ||
    env?.POSTGRES_URL ||
    (typeof process !== 'undefined' ? process.env?.DATABASE_URL || process.env?.POSTGRES_URL : null);

  if (url && typeof url === 'string' && url.trim()) {
    return url.trim();
  }

  // Assemble from individual PG* variables if present
  const host = env?.PGHOST || (typeof process !== 'undefined' ? process.env?.PGHOST : null);
  const user = env?.PGUSER || (typeof process !== 'undefined' ? process.env?.PGUSER : null);
  const password = env?.PGPASSWORD || (typeof process !== 'undefined' ? process.env?.PGPASSWORD : null);
  const database = env?.PGDATABASE || (typeof process !== 'undefined' ? process.env?.PGDATABASE : null);
  const port = env?.PGPORT || (typeof process !== 'undefined' ? process.env?.PGPORT : '5432');

  if (host && database && user) {
    const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
    return `postgres://${auth}@${host}:${port}/${database}`;
  }

  return null;
}

/**
 * Execute a query with parameters against PostgreSQL
 */
export async function query(sqlText, params = [], env = {}) {
  const connectionString = getConnectionString(env);
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured. Please set DATABASE_URL or POSTGRES_URL in your Cloudflare / server environment.');
  }

  // If it's a neon.tech domain and not using hyperdrive, we can use neon HTTP or NeonPool
  const isNeonHttp = connectionString.includes('neon.tech') && !connectionString.includes('sslmode=disable');

  if (isNeonHttp) {
    try {
      const sql = neon(connectionString);
      const rows = await sql(sqlText, params);
      return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
    } catch (neonErr) {
      // Fallback to Pool if HTTP query fails
      console.warn('[DB] Neon HTTP query failed, falling back to connection pool:', neonErr.message);
    }
  }

  // Use connection pool
  let pool = poolCache.get(connectionString);
  if (!pool) {
    try {
      // For Cloudflare Worker / Edge runtime, NeonPool or pg Pool with SSL
      const isSsl = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1') && !connectionString.includes('sslmode=disable');
      
      // In serverless / worker environments, NeonPool works over WebSockets
      if (typeof WebSocket !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
        pool = new NeonPool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          ssl: isSsl ? { rejectUnauthorized: false } : undefined
        });
      } else {
        pool = new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          ssl: isSsl ? { rejectUnauthorized: false } : undefined
        });
      }
      poolCache.set(connectionString, pool);
    } catch (err) {
      console.error('[DB] Failed to create PostgreSQL pool:', err);
      throw err;
    }
  }

  try {
    const result = await pool.query(sqlText, params);
    return result;
  } catch (err) {
    console.error('[DB] Query execution error:', err.message, '\nSQL:', sqlText);
    throw err;
  }
}

/**
 * Initializes the database schema automatically
 */
export async function initDb(env = {}) {
  const connectionString = getConnectionString(env);
  if (!connectionString) return false;

  const initSql = `
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

    CREATE TABLE IF NOT EXISTS app_state (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    );

    CREATE TABLE IF NOT EXISTS roll_history (
      id VARCHAR(255) PRIMARY KEY,
      character_id VARCHAR(255),
      character_name VARCHAR(255),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      timestamp BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_roll_history_timestamp ON roll_history(timestamp DESC);
  `;

  try {
    await query(initSql, [], env);
    schemaInitialized = true;
    return true;
  } catch (err) {
    console.error('[DB] Error initializing database schema:', err);
    throw err;
  }
}

/**
 * Ensure database is initialized before running operations
 */
async function ensureInit(env = {}) {
  if (!schemaInitialized) {
    await initDb(env);
  }
}

/**
 * Fetch full state from PostgreSQL
 */
export async function getFullStateFromDb(env = {}) {
  await ensureInit(env);

  // Fetch all characters
  const charRes = await query(`
    SELECT id, name, owner_id AS "ownerId", owner_name AS "ownerName", data, updated_at AS "updatedAt"
    FROM characters
    ORDER BY updated_at DESC
  `, [], env);

  const characters = {};
  for (const row of charRes.rows) {
    let charData = row.data;
    if (typeof charData === 'string') {
      try { charData = JSON.parse(charData); } catch (e) {}
    }
    characters[row.id] = {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      updatedAt: Number(row.updatedAt) || Date.now(),
      data: charData || {}
    };
  }

  // Fetch global app state keys (assignments, initiativeTracker, knownPlayers, meta)
  const stateRes = await query(`
    SELECT key, value, updated_at AS "updatedAt"
    FROM app_state
  `, [], env);

  let assignments = {};
  let initiativeTracker = {};
  let knownPlayers = {};
  let lastUpdatedAt = 0;

  for (const row of stateRes.rows) {
    let val = row.value;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) {}
    }
    const rowUpdatedAt = Number(row.updatedAt) || 0;
    if (rowUpdatedAt > lastUpdatedAt) lastUpdatedAt = rowUpdatedAt;

    if (row.key === 'assignments') assignments = val || {};
    else if (row.key === 'initiativeTracker') initiativeTracker = val || {};
    else if (row.key === 'knownPlayers') knownPlayers = val || {};
    else if (row.key === 'global') {
      if (val?.updatedAt && val.updatedAt > lastUpdatedAt) lastUpdatedAt = val.updatedAt;
    }
  }

  // Re-verify assignments from current characters if assignments is empty or missing entries
  Object.entries(characters).forEach(([cId, c]) => {
    if (c.ownerId) {
      assignments[c.ownerId] ??= [];
      if (!assignments[c.ownerId].includes(cId)) {
        assignments[c.ownerId].push(cId);
      }
    }
  });

  // Fetch recent roll history (last 200 rolls)
  const rollsRes = await query(`
    SELECT id, character_id AS "characterId", character_name AS "characterName", data, timestamp
    FROM roll_history
    ORDER BY timestamp DESC
    LIMIT 200
  `, [], env);

  const rollHistory = rollsRes.rows.map((row) => {
    let rollData = row.data;
    if (typeof rollData === 'string') {
      try { rollData = JSON.parse(rollData); } catch (e) {}
    }
    return {
      id: row.id,
      characterId: row.characterId,
      characterName: row.characterName,
      timestamp: Number(row.timestamp),
      ...(rollData && typeof rollData === 'object' ? rollData : {})
    };
  });

  // Calculate overall state updatedAt
  const charTimes = Object.values(characters).map((c) => Number(c.updatedAt) || 0);
  const maxCharTime = charTimes.length ? Math.max(...charTimes) : 0;
  const stateUpdatedAt = Math.max(lastUpdatedAt, maxCharTime, Date.now());

  return {
    updatedAt: stateUpdatedAt,
    characters,
    assignments,
    initiativeTracker,
    knownPlayers,
    rollHistory
  };
}

/**
 * Upserts a single character into PostgreSQL
 */
export async function upsertCharacterInDb(id, characterData, env = {}) {
  await ensureInit(env);

  const name = characterData.name || '';
  const ownerId = characterData.ownerId || null;
  const ownerName = characterData.ownerName || null;
  const updatedAt = Number(characterData.updatedAt) || Date.now();
  const data = characterData.data || {};

  await query(`
    INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      owner_id = EXCLUDED.owner_id,
      owner_name = EXCLUDED.owner_name,
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `, [id, name, ownerId, ownerName, JSON.stringify(data), updatedAt], env);

  // Update assignment if ownerId is present
  if (ownerId) {
    const assignRow = await query(`SELECT value FROM app_state WHERE key = 'assignments'`, [], env);
    let assignments = {};
    if (assignRow.rows.length > 0) {
      assignments = typeof assignRow.rows[0].value === 'string'
        ? JSON.parse(assignRow.rows[0].value)
        : (assignRow.rows[0].value || {});
    }
    assignments[ownerId] ??= [];
    if (!assignments[ownerId].includes(id)) {
      assignments[ownerId].push(id);
      await query(`
        INSERT INTO app_state (key, value, updated_at)
        VALUES ('assignments', $1::jsonb, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `, [JSON.stringify(assignments), Date.now()], env);
    }
  }

  return {
    id,
    name,
    ownerId,
    ownerName,
    data,
    updatedAt
  };
}

/**
 * Deletes a character by ID from PostgreSQL
 */
export async function deleteCharacterFromDb(id, env = {}) {
  await ensureInit(env);

  const res = await query(`DELETE FROM characters WHERE id = $1`, [id], env);
  const deleted = (res.rowCount || 0) > 0;

  // Clean up assignments
  const assignRow = await query(`SELECT value FROM app_state WHERE key = 'assignments'`, [], env);
  if (assignRow.rows.length > 0) {
    let assignments = typeof assignRow.rows[0].value === 'string'
      ? JSON.parse(assignRow.rows[0].value)
      : (assignRow.rows[0].value || {});
    let changed = false;
    for (const ownerId of Object.keys(assignments)) {
      if (Array.isArray(assignments[ownerId]) && assignments[ownerId].includes(id)) {
        assignments[ownerId] = assignments[ownerId].filter((charId) => charId !== id);
        changed = true;
      }
    }
    if (changed) {
      await query(`
        UPDATE app_state SET value = $1::jsonb, updated_at = $2 WHERE key = 'assignments'
      `, [JSON.stringify(assignments), Date.now()], env);
    }
  }

  // Clean up initiative tracker
  const initRow = await query(`SELECT value FROM app_state WHERE key = 'initiativeTracker'`, [], env);
  if (initRow.rows.length > 0) {
    let tracker = typeof initRow.rows[0].value === 'string'
      ? JSON.parse(initRow.rows[0].value)
      : (initRow.rows[0].value || {});
    if (tracker[id]) {
      delete tracker[id];
      await query(`
        UPDATE app_state SET value = $1::jsonb, updated_at = $2 WHERE key = 'initiativeTracker'
      `, [JSON.stringify(tracker), Date.now()], env);
    }
  }

  return deleted;
}

/**
 * Synchronize incoming state with PostgreSQL database
 */
export async function syncStateWithDb(incomingState, deletedCharacterIds = [], env = {}) {
  await ensureInit(env);

  const now = Date.now();

  // 1. Process deleted characters
  if (Array.isArray(deletedCharacterIds) && deletedCharacterIds.length > 0) {
    for (const dId of deletedCharacterIds) {
      await deleteCharacterFromDb(dId, env);
    }
  }

  // 2. Fetch existing characters to compare timestamps
  const existingCharsRes = await query(`SELECT id, updated_at AS "updatedAt" FROM characters`, [], env);
  const existingCharTimes = new Map();
  existingCharsRes.rows.forEach((r) => existingCharTimes.set(r.id, Number(r.updatedAt) || 0));

  // 3. Upsert newer characters
  const inChars = incomingState.characters || {};
  const deletedSet = new Set(deletedCharacterIds || []);

  for (const [id, char] of Object.entries(inChars)) {
    if (deletedSet.has(id)) continue;
    const incomingTime = Number(char.updatedAt) || Number(incomingState.updatedAt) || now;
    const existingTime = existingCharTimes.get(id) || 0;

    if (!existingCharTimes.has(id) || incomingTime >= existingTime) {
      await query(`
        INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          owner_id = EXCLUDED.owner_id,
          owner_name = EXCLUDED.owner_name,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `, [
        id,
        char.name || '',
        char.ownerId || null,
        char.ownerName || null,
        JSON.stringify(char.data || {}),
        incomingTime
      ], env);
    }
  }

  // 4. Update app state records (assignments, initiativeTracker, knownPlayers)
  if (incomingState.assignments && Object.keys(incomingState.assignments).length > 0) {
    await query(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('assignments', $1::jsonb, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, [JSON.stringify(incomingState.assignments), now], env);
  }

  if (incomingState.initiativeTracker && Object.keys(incomingState.initiativeTracker).length > 0) {
    await query(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('initiativeTracker', $1::jsonb, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, [JSON.stringify(incomingState.initiativeTracker), now], env);
  }

  if (incomingState.knownPlayers && Object.keys(incomingState.knownPlayers).length > 0) {
    await query(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('knownPlayers', $1::jsonb, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, [JSON.stringify(incomingState.knownPlayers), now], env);
  }

  // 5. Insert incoming rolls
  if (Array.isArray(incomingState.rollHistory) && incomingState.rollHistory.length > 0) {
    for (const roll of incomingState.rollHistory.slice(0, 100)) {
      if (!roll || !roll.id) continue;
      const { id, characterId, characterName, timestamp, ...rest } = roll;
      await query(`
        INSERT INTO roll_history (id, character_id, character_name, data, timestamp)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        characterId || null,
        characterName || null,
        JSON.stringify(rest || {}),
        Number(timestamp) || now
      ], env);
    }
  }

  // Return full merged state from database
  return await getFullStateFromDb(env);
}

/**
 * Save / Replace entire state into PostgreSQL (e.g. for imports or backup restores)
 */
export async function saveFullStateToDb(state, env = {}) {
  await ensureInit(env);

  const now = Number(state.updatedAt) || Date.now();
  const characters = state.characters || {};

  // Insert or update all characters
  for (const [id, char] of Object.entries(characters)) {
    if (!char) continue;
    await query(`
      INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        owner_id = EXCLUDED.owner_id,
        owner_name = EXCLUDED.owner_name,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at
    `, [
      id,
      char.name || '',
      char.ownerId || null,
      char.ownerName || null,
      JSON.stringify(char.data || {}),
      Number(char.updatedAt) || now
    ], env);
  }

  // Save app_state values
  const appStateEntries = [
    { key: 'assignments', value: state.assignments || {} },
    { key: 'initiativeTracker', value: state.initiativeTracker || {} },
    { key: 'knownPlayers', value: state.knownPlayers || {} },
    { key: 'global', value: { updatedAt: now } }
  ];

  for (const entry of appStateEntries) {
    await query(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, [entry.key, JSON.stringify(entry.value), now], env);
  }

  // Save roll history
  if (Array.isArray(state.rollHistory)) {
    for (const roll of state.rollHistory.slice(0, 200)) {
      if (!roll || !roll.id) continue;
      const { id, characterId, characterName, timestamp, ...rest } = roll;
      await query(`
        INSERT INTO roll_history (id, character_id, character_name, data, timestamp)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        characterId || null,
        characterName || null,
        JSON.stringify(rest || {}),
        Number(timestamp) || now
      ], env);
    }
  }

  return await getFullStateFromDb(env);
}
