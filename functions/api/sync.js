import { syncStateWithDb } from '../../db.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { deletedCharacterIds, ...incomingState } = body || {};

    const merged = await syncStateWithDb(incomingState, deletedCharacterIds || [], env);

    return new Response(JSON.stringify({
      success: true,
      state: merged,
      serverTime: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare] Error syncing state with PostgreSQL:', err);
    return new Response(JSON.stringify({
      error: 'Failed to sync character sheets with PostgreSQL',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
