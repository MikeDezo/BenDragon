import { getFullStateFromDb, getConnectionString } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
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

  return new Response(JSON.stringify({
    status: 'ok',
    runtime: 'cloudflare-pages-functions',
    database: 'PostgreSQL',
    dbStatus,
    characterCount: charCount,
    updatedAt,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
