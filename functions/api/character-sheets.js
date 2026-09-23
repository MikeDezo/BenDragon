import { getFullStateFromDb, saveFullStateToDb } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const state = await getFullStateFromDb(env);
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare] Error getting character sheets from PostgreSQL:', err);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve character sheets from PostgreSQL',
      message: err.message
    }), {
      status: 500,
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

    const saved = await saveFullStateToDb(incoming, env);
    return new Response(JSON.stringify({
      success: true,
      updatedAt: saved.updatedAt,
      characterCount: Object.keys(saved.characters || {}).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare] Error saving state to PostgreSQL:', err);
    return new Response(JSON.stringify({
      error: 'Failed to save character sheets to PostgreSQL',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
