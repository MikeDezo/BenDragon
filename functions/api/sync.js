import { syncStateWithDb, getD1Binding, getConnectionString } from '../../db.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { deletedCharacterIds, ...incomingState } = body || {};

    if (getD1Binding(env) || getConnectionString(env)) {
      try {
        const merged = await syncStateWithDb(incomingState, deletedCharacterIds || [], env);
        return new Response(JSON.stringify({
          success: true,
          state: merged,
          serverTime: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (dbErr) {
        console.warn('[Pages Functions] Database sync error, returning accepted payload:', dbErr.message);
      }
    }

    // Fallback response with incoming state preserved
    return new Response(JSON.stringify({
      success: true,
      state: incomingState,
      serverTime: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare Pages] Error processing sync request:', err);
    return new Response(JSON.stringify({
      error: 'Failed to process sync request',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

