import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  getFullStateFromDb,
  saveFullStateToDb,
  syncStateWithDb,
  upsertCharacterInDb,
  deleteCharacterFromDb,
  getConnectionString,
  query
} from '../../db.js';

const app = new Hono();

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
  const isPostgres = Boolean(getConnectionString(env));
  let charCount = 0;
  let updatedAt = null;
  let dbStatus = isPostgres ? 'connected' : 'unconfigured';

  if (isPostgres) {
    try {
      const state = await getFullStateFromDb(env);
      charCount = Object.keys(state.characters || {}).length;
      updatedAt = state.updatedAt;
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }
  }

  return c.json({
    status: 'ok',
    runtime: 'cloudflare-worker',
    database: 'PostgreSQL',
    dbStatus,
    characterCount: charCount,
    updatedAt,
    timestamp: Date.now()
  });
});

// Get all character sheets / state
app.get('/api/character-sheets', async (c) => {
  const state = await getFullStateFromDb(c.env);
  return c.json(state);
});

app.get('/api/state', async (c) => {
  const state = await getFullStateFromDb(c.env);
  return c.json(state);
});

// Save full state
app.post('/api/character-sheets', async (c) => {
  const incoming = await c.req.json();
  if (!incoming || typeof incoming !== 'object') {
    return c.json({ error: 'Invalid state payload' }, 400);
  }
  const saved = await saveFullStateToDb(incoming, c.env);
  return c.json({
    success: true,
    updatedAt: saved.updatedAt,
    characterCount: Object.keys(saved.characters || {}).length
  });
});

app.post('/api/state', async (c) => {
  const incoming = await c.req.json();
  if (!incoming || typeof incoming !== 'object') {
    return c.json({ error: 'Invalid state payload' }, 400);
  }
  const saved = await saveFullStateToDb(incoming, c.env);
  return c.json({
    success: true,
    updatedAt: saved.updatedAt,
    characterCount: Object.keys(saved.characters || {}).length
  });
});

// Sync state (delta merge)
app.post('/api/sync', async (c) => {
  const body = await c.req.json();
  const { deletedCharacterIds, ...incomingState } = body || {};
  const merged = await syncStateWithDb(incomingState, deletedCharacterIds || [], c.env);
  return c.json({
    success: true,
    state: merged,
    serverTime: Date.now()
  });
});

// Single character operations
app.get('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const res = await query(
    `SELECT id, name, owner_id AS "ownerId", owner_name AS "ownerName", data, updated_at AS "updatedAt"
     FROM characters WHERE id = $1`,
    [id],
    c.env
  );

  if (res.rows.length === 0) {
    return c.json({ error: 'Character not found' }, 404);
  }

  const row = res.rows[0];
  let charData = row.data;
  if (typeof charData === 'string') {
    try { charData = JSON.parse(charData); } catch (e) {}
  }

  const character = {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    updatedAt: Number(row.updatedAt) || Date.now(),
    data: charData || {}
  };

  return c.json({ character });
});

app.put('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const characterData = await c.req.json();
  if (!characterData || typeof characterData !== 'object') {
    return c.json({ error: 'Invalid character data payload' }, 400);
  }
  const saved = await upsertCharacterInDb(id, characterData, c.env);
  return c.json({ success: true, character: saved });
});

app.post('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const characterData = await c.req.json();
  if (!characterData || typeof characterData !== 'object') {
    return c.json({ error: 'Invalid character data payload' }, 400);
  }
  const saved = await upsertCharacterInDb(id, characterData, c.env);
  return c.json({ success: true, character: saved });
});

app.delete('/api/characters/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await deleteCharacterFromDb(id, c.env);
  return c.json({ success: true, deleted, id });
});

// Export character data
app.get('/api/export', async (c) => {
  const state = await getFullStateFromDb(c.env);
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
  const saved = await saveFullStateToDb(imported, c.env);
  return c.json({
    success: true,
    characterCount: Object.keys(saved.characters || {}).length,
    updatedAt: saved.updatedAt
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
