import { Pool } from 'pg';
import { neon } from '@neondatabase/serverless';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Cache client pools across warm worker / server invocations
const poolCache = new Map();
let schemaInitialized = false;
let localSqliteD1 = null;

const require = createRequire(import.meta.url);
let NodeDatabaseSync = null;
try {
  if (typeof process !== 'undefined' && process.versions?.node) {
    NodeDatabaseSync = require('node:sqlite').DatabaseSync;
  }
} catch (e) {}

/**
 * Creates a D1-compatible API wrapper around Node.js DatabaseSync (node:sqlite)
 * for local development and offline/testing environments.
 */
function createNodeSqliteD1() {
  if (!NodeDatabaseSync) {
    return null;
  }

  try {
    let dbPath = ':memory:';
    try {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      dbPath = path.join(dataDir, 'bendragon.sqlite');
    } catch (e) {
      dbPath = ':memory:';
    }

    const sqliteDb = new NodeDatabaseSync(dbPath);

    return {
      isLocalAdapter: true,
      prepare(sql) {
        let boundParams = [];
        const prepared = {
          bind(...params) {
            boundParams = params.map((p) => (p === undefined ? null : p));
            return prepared;
          },
          async all() {
            try {
              const stmt = sqliteDb.prepare(sql);
              const results = stmt.all(...boundParams);
              return { results: results || [], success: true, meta: { changes: 0 } };
            } catch (err) {
              console.error('[SQLite D1 Adapter] all() query error:', err.message, '\nSQL:', sql);
              throw err;
            }
          },
          async run() {
            try {
              const stmt = sqliteDb.prepare(sql);
              const info = stmt.run(...boundParams);
              return {
                success: true,
                meta: {
                  changes: info?.changes ?? 0,
                  last_row_id: Number(info?.lastInsertRowid ?? 0)
                }
              };
            } catch (err) {
              console.error('[SQLite D1 Adapter] run() query error:', err.message, '\nSQL:', sql);
              throw err;
            }
          },
          async first(colName) {
            try {
              const stmt = sqliteDb.prepare(sql);
              const row = stmt.get(...boundParams);
              if (!row) return null;
              if (colName && typeof colName === 'string') {
                return row[colName] ?? null;
              }
              return row;
            } catch (err) {
              console.error('[SQLite D1 Adapter] first() query error:', err.message, '\nSQL:', sql);
              throw err;
            }
          },
          async raw() {
            try {
              const stmt = sqliteDb.prepare(sql);
              const rows = stmt.all(...boundParams);
              return (rows || []).map((r) => Object.values(r));
            } catch (err) {
              console.error('[SQLite D1 Adapter] raw() query error:', err.message, '\nSQL:', sql);
              throw err;
            }
          }
        };
        return prepared;
      },
      async batch(statements) {
        if (!statements || statements.length === 0) return [];
        const spName = `d1_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sqliteDb.exec(`SAVEPOINT ${spName}`);
        const results = [];
        try {
          for (const stmt of statements) {
            results.push(await stmt.run());
          }
          sqliteDb.exec(`RELEASE SAVEPOINT ${spName}`);
          return results;
        } catch (err) {
          try { sqliteDb.exec(`ROLLBACK TO SAVEPOINT ${spName}`); } catch (e) {}
          throw err;
        }
      },
      async exec(sql) {
        sqliteDb.exec(sql);
        return { count: 1, duration: 0 };
      }
    };
  } catch (err) {
    console.warn('[DB] Could not initialize local SQLite DatabaseSync adapter:', err.message);
    return null;
  }
}

/**
 * Resolves Cloudflare D1 database binding (bendragonDB)
 */
export function getD1Binding(env = {}) {
  if (env && typeof env === 'object') {
    const binding =
      env.DB ||
      env.bendragonDB ||
      env.BENDRAGON_DB ||
      env.BENDRAGONDB ||
      env.bendragon ||
      env.d1 ||
      env.D1 ||
      env.DATABASE ||
      null;

    if (binding && typeof binding.prepare === 'function') {
      return binding;
    }
  }

  // Fallback to local Node SQLite D1 adapter if running in Node
  if (typeof process !== 'undefined' && process.versions?.node) {
    if (!localSqliteD1) {
      localSqliteD1 = createNodeSqliteD1();
    }
    return localSqliteD1;
  }

  return null;
}

/**
 * Checks if Cloudflare D1 (or local SQLite) is available
 */
export function isD1Configured(env = {}) {
  return Boolean(getD1Binding(env));
}

/**
 * Resolves PostgreSQL connection string (legacy fallback)
 */
export function getConnectionString(env = {}) {
  if (env?.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }

  const url =
    env?.DATABASE_URL ||
    env?.POSTGRES_URL ||
    (typeof process !== 'undefined' ? process.env?.DATABASE_URL || process.env?.POSTGRES_URL : null);

  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url.trim();
  }

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
 * Execute raw SQL query across D1 or PostgreSQL
 */
export async function query(sqlText, params = [], env = {}) {
  const d1 = getD1Binding(env);
  if (d1) {
    await ensureInit(env);
    const sqliteSql = sqlText.replace(/\$(\d+)/g, '?');
    const isSelect = /^\s*(SELECT|PRAGMA)/i.test(sqliteSql);
    const stmt = d1.prepare(sqliteSql).bind(...params);

    if (isSelect) {
      const res = await stmt.all();
      return {
        rows: res?.results || [],
        rowCount: res?.results ? res.results.length : 0
      };
    } else {
      const res = await stmt.run();
      return {
        rows: [],
        rowCount: res?.meta?.changes ?? (res?.success ? 1 : 0)
      };
    }
  }

  const connectionString = getConnectionString(env);
  if (!connectionString) {
    throw new Error('No database configured. Cloudflare D1 binding (bendragonDB) or DATABASE_URL must be available.');
  }

  const isNeonHttp = connectionString.includes('neon.tech') && !connectionString.includes('sslmode=disable');
  if (isNeonHttp) {
    try {
      const sql = neon(connectionString, { fullResults: true });
      const res = await sql(sqlText, params);
      return {
        rows: res?.rows || (Array.isArray(res) ? res : []),
        rowCount: res?.rowCount ?? (res?.rows ? res.rows.length : (Array.isArray(res) ? res.length : 0))
      };
    } catch (neonErr) {
      console.warn('[DB] Neon HTTP query failed, falling back to connection pool:', neonErr.message);
    }
  }

  let pool = poolCache.get(connectionString);
  if (!pool) {
    const isSsl = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1') && !connectionString.includes('sslmode=disable');
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl: isSsl ? { rejectUnauthorized: false } : false
    });
    poolCache.set(connectionString, pool);
  }

  return await pool.query(sqlText, params);
}

/**
 * Initializes the database schema automatically (D1 SQLite or PostgreSQL)
 */
export async function initDb(env = {}) {
  const d1 = getD1Binding(env);
  if (d1) {
    try {
      await d1.exec(`
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

        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT '{}',
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );

        CREATE TABLE IF NOT EXISTS roll_history (
          id TEXT PRIMARY KEY,
          character_id TEXT,
          character_name TEXT,
          data TEXT NOT NULL DEFAULT '{}',
          timestamp INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_roll_history_timestamp ON roll_history(timestamp DESC);
      `);
      schemaInitialized = true;
      return true;
    } catch (err) {
      console.error('[DB] D1 schema initialization error:', err.message);
      throw err;
    }
  }

  const connectionString = getConnectionString(env);
  if (!connectionString) return false;

  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS characters (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      owner_id VARCHAR(255),
      owner_name VARCHAR(255),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_characters_owner_id ON characters(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_characters_updated_at ON characters(updated_at)`,
    `CREATE TABLE IF NOT EXISTS app_state (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS roll_history (
      id VARCHAR(255) PRIMARY KEY,
      character_id VARCHAR(255),
      character_name VARCHAR(255),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      timestamp BIGINT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_roll_history_timestamp ON roll_history(timestamp DESC)`
  ];

  try {
    for (const stmt of ddlStatements) {
      await query(stmt, [], env);
    }
    schemaInitialized = true;
    return true;
  } catch (err) {
    console.error('[DB] Error initializing PostgreSQL schema:', err.message);
    throw err;
  }
}

/**
 * Ensure database schema is initialized
 */
async function ensureInit(env = {}) {
  if (!schemaInitialized) {
    await initDb(env);
  }
}

/**
 * Fetch full state from Cloudflare D1 (or PostgreSQL)
 */
export async function getFullStateFromDb(env = {}) {
  await ensureInit(env);
  const d1 = getD1Binding(env);

  if (d1) {
    // 1. Fetch all characters
    const charRes = await d1.prepare(`
      SELECT id, name, owner_id AS ownerId, owner_name AS ownerName, data, updated_at AS updatedAt
      FROM characters
      ORDER BY updated_at DESC
    `).all();

    const characters = {};
    const charRows = charRes?.results || [];
    for (const row of charRows) {
      let charData = row.data;
      if (typeof charData === 'string') {
        try { charData = JSON.parse(charData); } catch (e) {}
      }
      characters[row.id] = {
        id: row.id,
        name: row.name || '',
        ownerId: row.ownerId || null,
        ownerName: row.ownerName || null,
        updatedAt: Number(row.updatedAt) || Date.now(),
        data: charData || {}
      };
    }

    // 2. Fetch app_state
    const stateRes = await d1.prepare(`
      SELECT key, value, updated_at AS updatedAt
      FROM app_state
    `).all();

    let assignments = {};
    let initiativeTracker = {};
    let knownPlayers = {};
    let lastUpdatedAt = 0;

    const stateRows = stateRes?.results || [];
    for (const row of stateRows) {
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
        if (val?.updatedAt && Number(val.updatedAt) > lastUpdatedAt) {
          lastUpdatedAt = Number(val.updatedAt);
        }
      }
    }

    // Ensure assignments include all characters that have an ownerId
    Object.entries(characters).forEach(([cId, c]) => {
      if (c.ownerId) {
        assignments[c.ownerId] ??= [];
        if (!assignments[c.ownerId].includes(cId)) {
          assignments[c.ownerId].push(cId);
        }
      }
    });

    // 3. Fetch roll history (last 200)
    const rollsRes = await d1.prepare(`
      SELECT id, character_id AS characterId, character_name AS characterName, data, timestamp
      FROM roll_history
      ORDER BY timestamp DESC
      LIMIT 200
    `).all();

    const rollRows = rollsRes?.results || [];
    const rollHistory = rollRows.map((row) => {
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

  // PostgreSQL fallback
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

  Object.entries(characters).forEach(([cId, c]) => {
    if (c.ownerId) {
      assignments[c.ownerId] ??= [];
      if (!assignments[c.ownerId].includes(cId)) {
        assignments[c.ownerId].push(cId);
      }
    }
  });

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
 * Upserts a single character into D1 SQLite (or PostgreSQL)
 */
export async function upsertCharacterInDb(id, characterData, env = {}) {
  await ensureInit(env);
  const name = characterData.name || '';
  const ownerId = characterData.ownerId || null;
  const ownerName = characterData.ownerName || null;
  const updatedAt = Number(characterData.updatedAt) || Date.now();
  const data = characterData.data || {};
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

  const d1 = getD1Binding(env);
  if (d1) {
    const stmts = [
      d1.prepare(`
        INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          owner_id = excluded.owner_id,
          owner_name = excluded.owner_name,
          data = excluded.data,
          updated_at = excluded.updated_at
      `).bind(id, name, ownerId, ownerName, dataStr, updatedAt)
    ];

    if (ownerId) {
      const assignRow = await d1.prepare(`SELECT value FROM app_state WHERE key = 'assignments'`).first();
      let assignments = {};
      if (assignRow?.value) {
        assignments = typeof assignRow.value === 'string' ? JSON.parse(assignRow.value) : assignRow.value;
      }
      assignments[ownerId] ??= [];
      if (!assignments[ownerId].includes(id)) {
        assignments[ownerId].push(id);
        stmts.push(
          d1.prepare(`
            INSERT INTO app_state (key, value, updated_at)
            VALUES ('assignments', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
          `).bind(JSON.stringify(assignments), Date.now())
        );
      }
    }

    await d1.batch(stmts);

    return {
      id,
      name,
      ownerId,
      ownerName,
      data: typeof data === 'object' ? data : JSON.parse(dataStr),
      updatedAt
    };
  }

  // PostgreSQL
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
 * Deletes a character by ID from D1 SQLite (or PostgreSQL)
 */
export async function deleteCharacterFromDb(id, env = {}) {
  await ensureInit(env);
  const d1 = getD1Binding(env);

  if (d1) {
    const stmts = [
      d1.prepare(`DELETE FROM characters WHERE id = ?`).bind(id)
    ];

    const assignRow = await d1.prepare(`SELECT value FROM app_state WHERE key = 'assignments'`).first();
    if (assignRow?.value) {
      let assignments = typeof assignRow.value === 'string' ? JSON.parse(assignRow.value) : assignRow.value;
      let changed = false;
      for (const ownerId of Object.keys(assignments)) {
        if (Array.isArray(assignments[ownerId]) && assignments[ownerId].includes(id)) {
          assignments[ownerId] = assignments[ownerId].filter((charId) => charId !== id);
          changed = true;
        }
      }
      if (changed) {
        stmts.push(
          d1.prepare(`
            UPDATE app_state SET value = ?, updated_at = ? WHERE key = 'assignments'
          `).bind(JSON.stringify(assignments), Date.now())
        );
      }
    }

    const initRow = await d1.prepare(`SELECT value FROM app_state WHERE key = 'initiativeTracker'`).first();
    if (initRow?.value) {
      let tracker = typeof initRow.value === 'string' ? JSON.parse(initRow.value) : initRow.value;
      if (tracker[id]) {
        delete tracker[id];
        stmts.push(
          d1.prepare(`
            UPDATE app_state SET value = ?, updated_at = ? WHERE key = 'initiativeTracker'
          `).bind(JSON.stringify(tracker), Date.now())
        );
      }
    }

    const results = await d1.batch(stmts);
    return (results[0]?.meta?.changes ?? 1) > 0;
  }

  const res = await query(`DELETE FROM characters WHERE id = $1`, [id], env);
  const deleted = (res.rowCount || 0) > 0;

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
 * Synchronize incoming state with D1 SQLite (or PostgreSQL)
 */
export async function syncStateWithDb(incomingState, deletedCharacterIds = [], env = {}) {
  await ensureInit(env);
  const now = Date.now();
  const d1 = getD1Binding(env);

  if (d1) {
    const stmts = [];

    // 1. Process deleted characters
    if (Array.isArray(deletedCharacterIds) && deletedCharacterIds.length > 0) {
      for (const dId of deletedCharacterIds) {
        stmts.push(d1.prepare(`DELETE FROM characters WHERE id = ?`).bind(dId));
      }
    }

    // 2. Fetch existing characters to compare timestamps
    const existingCharsRes = await d1.prepare(`SELECT id, updated_at AS updatedAt FROM characters`).all();
    const existingCharTimes = new Map();
    (existingCharsRes?.results || []).forEach((r) => existingCharTimes.set(r.id, Number(r.updatedAt) || 0));

    // 3. Upsert newer characters
    const inChars = incomingState.characters || {};
    const deletedSet = new Set(deletedCharacterIds || []);

    for (const [id, char] of Object.entries(inChars)) {
      if (deletedSet.has(id)) continue;
      const incomingTime = Number(char.updatedAt) || Number(incomingState.updatedAt) || now;
      const existingTime = existingCharTimes.get(id) || 0;

      if (!existingCharTimes.has(id) || incomingTime >= existingTime) {
        const dataStr = typeof char.data === 'string' ? char.data : JSON.stringify(char.data || {});
        stmts.push(
          d1.prepare(`
            INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              owner_id = excluded.owner_id,
              owner_name = excluded.owner_name,
              data = excluded.data,
              updated_at = excluded.updated_at
          `).bind(
            id,
            char.name || '',
            char.ownerId || null,
            char.ownerName || null,
            dataStr,
            incomingTime
          )
        );
      }
    }

    // 4. Update app state records
    if (incomingState.assignments && Object.keys(incomingState.assignments).length > 0) {
      stmts.push(
        d1.prepare(`
          INSERT INTO app_state (key, value, updated_at)
          VALUES ('assignments', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(JSON.stringify(incomingState.assignments), now)
      );
    }

    if (incomingState.initiativeTracker && Object.keys(incomingState.initiativeTracker).length > 0) {
      stmts.push(
        d1.prepare(`
          INSERT INTO app_state (key, value, updated_at)
          VALUES ('initiativeTracker', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(JSON.stringify(incomingState.initiativeTracker), now)
      );
    }

    if (incomingState.knownPlayers && Object.keys(incomingState.knownPlayers).length > 0) {
      stmts.push(
        d1.prepare(`
          INSERT INTO app_state (key, value, updated_at)
          VALUES ('knownPlayers', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(JSON.stringify(incomingState.knownPlayers), now)
      );
    }

    // 5. Insert incoming rolls
    if (Array.isArray(incomingState.rollHistory) && incomingState.rollHistory.length > 0) {
      for (const roll of incomingState.rollHistory.slice(0, 100)) {
        if (!roll || !roll.id) continue;
        const { id, characterId, characterName, timestamp, ...rest } = roll;
        stmts.push(
          d1.prepare(`
            INSERT INTO roll_history (id, character_id, character_name, data, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `).bind(
            id,
            characterId || null,
            characterName || null,
            JSON.stringify(rest || {}),
            Number(timestamp) || now
          )
        );
      }
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      const chunk = stmts.slice(i, i + BATCH_SIZE);
      if (chunk.length > 0) {
        await d1.batch(chunk);
      }
    }

    return await getFullStateFromDb(env);
  }

  // PostgreSQL fallback
  if (Array.isArray(deletedCharacterIds) && deletedCharacterIds.length > 0) {
    for (const dId of deletedCharacterIds) {
      await deleteCharacterFromDb(dId, env);
    }
  }

  const existingCharsRes = await query(`SELECT id, updated_at AS "updatedAt" FROM characters`, [], env);
  const existingCharTimes = new Map();
  existingCharsRes.rows.forEach((r) => existingCharTimes.set(r.id, Number(r.updatedAt) || 0));

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

  return await getFullStateFromDb(env);
}

/**
 * Save / Replace entire state into D1 SQLite (or PostgreSQL)
 */
export async function saveFullStateToDb(state, env = {}) {
  await ensureInit(env);
  const now = Number(state.updatedAt) || Date.now();
  const characters = state.characters || {};
  const d1 = getD1Binding(env);

  if (d1) {
    const stmts = [];

    for (const [id, char] of Object.entries(characters)) {
      if (!char) continue;
      const dataStr = typeof char.data === 'string' ? char.data : JSON.stringify(char.data || {});
      stmts.push(
        d1.prepare(`
          INSERT INTO characters (id, name, owner_id, owner_name, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            owner_id = excluded.owner_id,
            owner_name = excluded.owner_name,
            data = excluded.data,
            updated_at = excluded.updated_at
        `).bind(
          id,
          char.name || '',
          char.ownerId || null,
          char.ownerName || null,
          dataStr,
          Number(char.updatedAt) || now
        )
      );
    }

    const appStateEntries = [
      { key: 'assignments', value: state.assignments || {} },
      { key: 'initiativeTracker', value: state.initiativeTracker || {} },
      { key: 'knownPlayers', value: state.knownPlayers || {} },
      { key: 'global', value: { updatedAt: now } }
    ];

    for (const entry of appStateEntries) {
      stmts.push(
        d1.prepare(`
          INSERT INTO app_state (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(entry.key, JSON.stringify(entry.value), now)
      );
    }

    if (Array.isArray(state.rollHistory)) {
      for (const roll of state.rollHistory.slice(0, 200)) {
        if (!roll || !roll.id) continue;
        const { id, characterId, characterName, timestamp, ...rest } = roll;
        stmts.push(
          d1.prepare(`
            INSERT INTO roll_history (id, character_id, character_name, data, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `).bind(
            id,
            characterId || null,
            characterName || null,
            JSON.stringify(rest || {}),
            Number(timestamp) || now
          )
        );
      }
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      const chunk = stmts.slice(i, i + BATCH_SIZE);
      if (chunk.length > 0) {
        await d1.batch(chunk);
      }
    }

    return await getFullStateFromDb(env);
  }

  // PostgreSQL
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

