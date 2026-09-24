import { getFullStateFromDb, getD1Binding, getConnectionString } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
  const hasD1 = Boolean(getD1Binding(env));
  const isPostgres = Boolean(getConnectionString(env));
  let charCount = 0;
  let updatedAt = null;
  let dbStatus = hasD1 ? 'connected' : (isPostgres ? 'connected' : 'unconfigured');
  let storageMode = hasD1 ? 'Cloudflare D1 (bendragonDB)' : (isPostgres ? 'PostgreSQL' : 'None');

  if (hasD1 || isPostgres) {
    try {
      const state = await getFullStateFromDb(env);
      charCount = Object.keys(state.characters || {}).length;
      updatedAt = state.updatedAt;
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }
  }

  return new Response(JSON.stringify({
    status: 'ok',
    runtime: 'cloudflare-pages-functions',
    database: 'bendragonDB',
    storageMode,
    dbStatus,
    characterCount: charCount,
    updatedAt,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

