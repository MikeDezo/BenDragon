import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  getD1Binding,
  isD1Configured,
  getFullStateFromDb,
  saveFullStateToDb,
  syncStateWithDb,
  upsertCharacterInDb,
  deleteCharacterFromDb,
  getConnectionString
} from '../../db.js';

const app = new Hono();

// Global in-memory cache for Worker isolate lifecycle
let edgeMemoryState = {
  updatedAt: Date.now(),
  characters: {},
  assignments: {},
  rollHistory: [],
  initiativeTracker: {},
  knownPlayers: {}
};

// Helper to check Cloudflare KV binding
function getKvBinding(env) {
  return env?.BENDRAGON_KV || env?.KV || env?.STORAGE || env?.BENDRAGON_STORE || null;
}

// Fetch current state from Cloudflare D1 (bendragonDB) -> PostgreSQL -> KV -> Memory
async function getEffectiveState(env) {
  const hasD1 = Boolean(getD1Binding(env));
  if (hasD1) {
    try {
      const d1State = await getFullStateFromDb(env);
      if (d1State && typeof d1State === 'object') {
        edgeMemoryState = d1State;
        return d1State;
      }
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 getFullState failed, checking fallbacks:', err.message);
    }
  }

  const isPostgres = Boolean(getConnectionString(env));
  if (isPostgres) {
    try {
      const dbState = await getFullStateFromDb(env);
      if (dbState && typeof dbState === 'object') {
        edgeMemoryState = dbState;
        return dbState;
      }
    } catch (err) {
      console.warn('[Worker] PostgreSQL getFullState failed, checking KV/memory:', err.message);
    }
  }

  const kv = getKvBinding(env);
  if (kv) {
    try {
      const kvState = await kv.get('terranova_state', { type: 'json' });
      if (kvState && typeof kvState === 'object') {
        edgeMemoryState = kvState;
        return kvState;
      }
    } catch (err) {
      console.warn('[Worker] KV read error:', err.message);
    }
  }

  return edgeMemoryState;
}

// Persist state to Cloudflare D1 (bendragonDB) -> PostgreSQL -> KV -> Memory
async function saveEffectiveState(state, env) {
  edgeMemoryState = state;
  let savedToDb = false;

  const hasD1 = Boolean(getD1Binding(env));
  if (hasD1) {
    try {
      await saveFullStateToDb(state, env);
      savedToDb = true;
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 save failed, checking fallbacks:', err.message);
    }
  }

  if (!savedToDb) {
    const isPostgres = Boolean(getConnectionString(env));
    if (isPostgres) {
      try {
        await saveFullStateToDb(state, env);
        savedToDb = true;
      } catch (err) {
        console.warn('[Worker] PostgreSQL save failed, falling back to KV/memory:', err.message);
      }
    }
  }

  const kv = getKvBinding(env);
  if (kv) {
    try {
      await kv.put('terranova_state', JSON.stringify(state));
    } catch (err) {
      console.warn('[Worker] KV write error:', err.message);
    }
  }

  return savedToDb;
}

// Synchronize state across Cloudflare D1 (bendragonDB) / PostgreSQL / KV / Memory
async function syncEffectiveState(incomingState, deletedCharacterIds = [], env) {
  const hasD1 = Boolean(getD1Binding(env));
  if (hasD1) {
    try {
      const mergedD1 = await syncStateWithDb(incomingState, deletedCharacterIds, env);
      if (mergedD1) {
        edgeMemoryState = mergedD1;
        const kv = getKvBinding(env);
        if (kv) {
          kv.put('terranova_state', JSON.stringify(mergedD1)).catch(() => {});
        }
        return mergedD1;
      }
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 sync failed, checking fallbacks:', err.message);
    }
  }

  const isPostgres = Boolean(getConnectionString(env));
  if (isPostgres) {
    try {
      const mergedDb = await syncStateWithDb(incomingState, deletedCharacterIds, env);
      if (mergedDb) {
        edgeMemoryState = mergedDb;
        const kv = getKvBinding(env);
        if (kv) {
          kv.put('terranova_state', JSON.stringify(mergedDb)).catch(() => {});
        }
        return mergedDb;
      }
    } catch (err) {
      console.warn('[Worker] PostgreSQL sync failed, falling back to local merge:', err.message);
    }
  }

  // Merge in memory
  const current = await getEffectiveState(env);
  const now = Date.now();
  const deletedSet = new Set(deletedCharacterIds || []);

  const merged = {
    updatedAt: Math.max(Number(current.updatedAt) || 0, Number(incomingState.updatedAt) || 0, now),
    characters: { ...(current.characters || {}) },
    assignments: { ...(current.assignments || {}), ...(incomingState.assignments || {}) },
    initiativeTracker: { ...(current.initiativeTracker || {}), ...(incomingState.initiativeTracker || {}) },
    knownPlayers: { ...(current.knownPlayers || {}), ...(incomingState.knownPlayers || {}) },
    rollHistory: []
  };

  // Remove deleted characters
  deletedSet.forEach((dId) => {
    delete merged.characters[dId];
    Object.keys(merged.assignments).forEach((ownerId) => {
      if (Array.isArray(merged.assignments[ownerId])) {
        merged.assignments[ownerId] = merged.assignments[ownerId].filter((id) => id !== dId);
      }
    });
    if (merged.initiativeTracker[dId]) {
      delete merged.initiativeTracker[dId];
    }
  });

  // Merge characters
  const inChars = incomingState.characters || {};
  const allIds = new Set([...Object.keys(merged.characters), ...Object.keys(inChars)]);
  allIds.forEach((id) => {
    if (deletedSet.has(id)) return;
    const curChar = merged.characters[id];
    const inChar = inChars[id];
    if (curChar && inChar) {
      const curTime = Number(curChar.updatedAt) || Number(current.updatedAt) || 0;
      const inTime = Number(inChar.updatedAt) || Number(incomingState.updatedAt) || 0;
      merged.characters[id] = inTime >= curTime ? inChar : curChar;
    } else if (inChar) {
      merged.characters[id] = inChar;
    }
  });

  // Update assignments
  Object.entries(merged.characters).forEach(([cId, c]) => {
    if (c.ownerId) {
      merged.assignments[c.ownerId] ??= [];
      if (!merged.assignments[c.ownerId].includes(cId)) {
        merged.assignments[c.ownerId].push(cId);
      }
    }
  });

  // Merge rolls
  const rollMap = new Map();
  (incomingState.rollHistory || []).forEach((r) => { if (r?.id) rollMap.set(r.id, r); });
  (current.rollHistory || []).forEach((r) => { if (r?.id && !rollMap.has(r.id)) rollMap.set(r.id, r); });
  merged.rollHistory = Array.from(rollMap.values())
    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
    .slice(0, 200);

  await saveEffectiveState(merged, env);
  return merged;
}

// Enable CORS for all routes (specifically for Owlbear Rodeo extension embedding)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma'],
  maxAge: 86400,
}));

// Apply Anti-Caching headers on all API endpoints
app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  c.header('Surrogate-Control', 'no-store');
});

// Global Error Handler
app.onError((err, c) => {
  console.error('[Worker API] Uncaught error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err?.message || 'An unexpected error occurred'
  }, 500);
});

// Health check endpoint
app.get('/api/health', async (c) => {
  const env = c.env || {};
  const hasD1 = Boolean(getD1Binding(env));
  const connStr = getConnectionString(env);
  const isPostgres = Boolean(connStr);
  const hasKv = Boolean(getKvBinding(env));

  let charCount = 0;
  let updatedAt = null;
  let dbStatus = hasD1 ? 'd1-configured' : (isPostgres ? 'postgres-configured' : (hasKv ? 'kv-bound' : 'memory-fallback'));
  let storageMode = hasD1 ? 'Cloudflare D1 (bendragonDB)' : (isPostgres ? 'PostgreSQL' : (hasKv ? 'Cloudflare KV' : 'Edge Memory'));
  let isConnected = false;

  if (hasD1) {
    try {
      const state = await getFullStateFromDb(env);
      charCount = Object.keys(state.characters || {}).length;
      updatedAt = state.updatedAt;
      dbStatus = 'connected';
      storageMode = 'Cloudflare D1 (bendragonDB)';
      isConnected = true;
    } catch (err) {
      dbStatus = `d1-error: ${err.message}`;
    }
  }

  if (!isConnected && isPostgres) {
    try {
      const state = await getFullStateFromDb(env);
      charCount = Object.keys(state.characters || {}).length;
      updatedAt = state.updatedAt;
      dbStatus = 'connected';
      storageMode = 'PostgreSQL';
      isConnected = true;
    } catch (err) {
      dbStatus = `postgres-error: ${err.message}`;
    }
  }

  if (!isConnected) {
    const state = await getEffectiveState(env);
    charCount = Object.keys(state.characters || {}).length;
    updatedAt = state.updatedAt;
  }

  return c.json({
    status: 'ok',
    runtime: 'cloudflare-worker',
    worker: 'bendragon',
    database: 'bendragonDB',
    storageMode,
    dbStatus,
    characterCount: charCount,
    updatedAt,
    timestamp: Date.now()
  });
});

// Get all character sheets / state
app.get('/api/character-sheets', async (c) => {
  const state = await getEffectiveState(c.env);
  return c.json(state);
});

app.get('/api/state', async (c) => {
  const state = await getEffectiveState(c.env);
  return c.json(state);
});

// Save full state
app.post('/api/character-sheets', async (c) => {
  const incoming = await c.req.json();
  if (!incoming || typeof incoming !== 'object') {
    return c.json({ error: 'Invalid state payload' }, 400);
  }
  await saveEffectiveState(incoming, c.env);
  const state = await getEffectiveState(c.env);
  return c.json({
    success: true,
    updatedAt: state.updatedAt,
    characterCount: Object.keys(state.characters || {}).length
  });
});

app.post('/api/state', async (c) => {
  const incoming = await c.req.json();
  if (!incoming || typeof incoming !== 'object') {
    return c.json({ error: 'Invalid state payload' }, 400);
  }
  await saveEffectiveState(incoming, c.env);
  const state = await getEffectiveState(c.env);
  return c.json({
    success: true,
    updatedAt: state.updatedAt,
    characterCount: Object.keys(state.characters || {}).length
  });
});

// Sync state (delta merge)
app.post('/api/sync', async (c) => {
  const body = await c.req.json();
  const { deletedCharacterIds, ...incomingState } = body || {};
  const merged = await syncEffectiveState(incomingState, deletedCharacterIds || [], c.env);
  return c.json({
    success: true,
    state: merged,
    serverTime: Date.now()
  });
});

// Single character operations
app.get('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const state = await getEffectiveState(c.env);
  const char = state.characters?.[id];
  if (!char) {
    return c.json({ error: 'Character not found' }, 404);
  }
  return c.json({ character: char });
});

app.put('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const characterData = await c.req.json();
  if (!characterData || typeof characterData !== 'object') {
    return c.json({ error: 'Invalid character data payload' }, 400);
  }

  const hasD1 = Boolean(getD1Binding(c.env));
  if (hasD1) {
    try {
      const saved = await upsertCharacterInDb(id, characterData, c.env);
      return c.json({ success: true, character: saved });
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 upsert failed, saving to local state:', err.message);
    }
  }

  const isPostgres = Boolean(getConnectionString(c.env));
  if (isPostgres) {
    try {
      const saved = await upsertCharacterInDb(id, characterData, c.env);
      return c.json({ success: true, character: saved });
    } catch (err) {
      console.warn('[Worker] PostgreSQL upsert failed, saving to local state:', err.message);
    }
  }

  const current = await getEffectiveState(c.env);
  const now = Date.now();
  current.characters[id] = {
    id,
    name: characterData.name || '',
    ownerId: characterData.ownerId || null,
    ownerName: characterData.ownerName || null,
    data: characterData.data || {},
    updatedAt: Number(characterData.updatedAt) || now
  };
  current.updatedAt = now;
  await saveEffectiveState(current, c.env);

  return c.json({ success: true, character: current.characters[id] });
});

app.post('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const characterData = await c.req.json();
  if (!characterData || typeof characterData !== 'object') {
    return c.json({ error: 'Invalid character data payload' }, 400);
  }

  const hasD1 = Boolean(getD1Binding(c.env));
  if (hasD1) {
    try {
      const saved = await upsertCharacterInDb(id, characterData, c.env);
      return c.json({ success: true, character: saved });
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 upsert failed, saving to local state:', err.message);
    }
  }

  const isPostgres = Boolean(getConnectionString(c.env));
  if (isPostgres) {
    try {
      const saved = await upsertCharacterInDb(id, characterData, c.env);
      return c.json({ success: true, character: saved });
    } catch (err) {
      console.warn('[Worker] PostgreSQL upsert failed, saving to local state:', err.message);
    }
  }

  const current = await getEffectiveState(c.env);
  const now = Date.now();
  current.characters[id] = {
    id,
    name: characterData.name || '',
    ownerId: characterData.ownerId || null,
    ownerName: characterData.ownerName || null,
    data: characterData.data || {},
    updatedAt: Number(characterData.updatedAt) || now
  };
  current.updatedAt = now;
  await saveEffectiveState(current, c.env);

  return c.json({ success: true, character: current.characters[id] });
});

app.delete('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const hasD1 = Boolean(getD1Binding(c.env));
  if (hasD1) {
    try {
      const deleted = await deleteCharacterFromDb(id, c.env);
      return c.json({ success: true, deleted, id });
    } catch (err) {
      console.warn('[Worker] Cloudflare D1 delete failed, updating local state:', err.message);
    }
  }

  const isPostgres = Boolean(getConnectionString(c.env));
  if (isPostgres) {
    try {
      const deleted = await deleteCharacterFromDb(id, c.env);
      return c.json({ success: true, deleted, id });
    } catch (err) {
      console.warn('[Worker] PostgreSQL delete failed, updating local state:', err.message);
    }
  }

  const current = await getEffectiveState(c.env);
  const deleted = Boolean(current.characters[id]);
  delete current.characters[id];
  current.updatedAt = Date.now();
  await saveEffectiveState(current, c.env);

  return c.json({ success: true, deleted, id });
});

// Export character data
app.get('/api/export', async (c) => {
  const state = await getEffectiveState(c.env);
  const dateStr = new Date().toISOString().slice(0, 10);
  c.header('Content-Disposition', `attachment; filename="terranova-characters-${dateStr}.json"`);
  return c.json(state);
});

// Import character data backup
app.post('/api/import', async (c) => {
  const imported = await c.req.json();
  if (!imported || typeof imported !== 'object' || !imported.characters) {
    return c.json({ error: 'Invalid backup file format' }, 400);
  }
  await saveEffectiveState(imported, c.env);
  const state = await getEffectiveState(c.env);
  return c.json({
    success: true,
    characterCount: Object.keys(state.characters || {}).length,
    updatedAt: state.updatedAt
  });
});

// Fallback: If request is not an API route and ASSETS binding exists (Cloudflare Workers Static Assets), serve static assets
app.all('*', (c) => {
  if (c.env && c.env.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;
