import { getFullStateFromDb, saveFullStateToDb, getD1Binding, getConnectionString } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    if (getD1Binding(env) || getConnectionString(env)) {
      const state = await getFullStateFromDb(env);
      return new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      updatedAt: Date.now(),
      characters: {},
      assignments: {},
      rollHistory: [],
      initiativeTracker: {},
      knownPlayers: {}
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.warn('[Pages Functions] Notice retrieving sheets:', err.message);
    return new Response(JSON.stringify({
      updatedAt: Date.now(),
      characters: {},
      assignments: {},
      rollHistory: [],
      initiativeTracker: {},
      knownPlayers: {}
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const incoming = await request.json();
    if (!incoming || typeof incoming !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid state payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (getD1Binding(env) || getConnectionString(env)) {
      try {
        const saved = await saveFullStateToDb(incoming, env);
        return new Response(JSON.stringify({
          success: true,
          updatedAt: saved.updatedAt,
          characterCount: Object.keys(saved.characters || {}).length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (dbErr) {
        console.warn('[Pages Functions] Database save error:', dbErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updatedAt: incoming.updatedAt || Date.now(),
      characterCount: Object.keys(incoming.characters || {}).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare] Error saving state:', err);
    return new Response(JSON.stringify({
      error: 'Failed to save character sheets',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

