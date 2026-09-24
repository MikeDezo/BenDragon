import {
  getFullStateFromDb,
  upsertCharacterInDb,
  deleteCharacterFromDb,
  getD1Binding,
  getConnectionString,
  query
} from '../../../db.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  if (!getD1Binding(env) && !getConnectionString(env)) {
    return new Response(JSON.stringify({ error: 'Character not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const res = await query(
      `SELECT id, name, owner_id AS "ownerId", owner_name AS "ownerName", data, updated_at AS "updatedAt"
       FROM characters WHERE id = $1`,
      [id],
      env
    );

    if (!res.rows || res.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const row = res.rows[0];
    let charData = row.data;
    if (typeof charData === 'string') {
      try { charData = JSON.parse(charData); } catch (e) {}
    }

    const character = {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId || row.owner_id,
      ownerName: row.ownerName || row.owner_name,
      updatedAt: Number(row.updatedAt || row.updated_at) || Date.now(),
      data: charData || {}
    };

    return new Response(JSON.stringify({ character }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Cloudflare] Error getting character ${id}:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve character from database',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  return handleUpsert(context);
}

export async function onRequestPost(context) {
  return handleUpsert(context);
}

async function handleUpsert(context) {
  const { request, env, params } = context;
  const id = params.id;

  try {
    const characterData = await request.json();
    if (!characterData || typeof characterData !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid character data payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (getD1Binding(env) || getConnectionString(env)) {
      const saved = await upsertCharacterInDb(id, characterData, env);
      return new Response(JSON.stringify({ success: true, character: saved }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      character: {
        id,
        name: characterData.name || '',
        ownerId: characterData.ownerId || null,
        ownerName: characterData.ownerName || null,
        data: characterData.data || {},
        updatedAt: Number(characterData.updatedAt) || Date.now()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Cloudflare] Error upserting character ${id}:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to update character',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    if (getD1Binding(env) || getConnectionString(env)) {
      const deleted = await deleteCharacterFromDb(id, env);
      return new Response(JSON.stringify({ success: true, deleted, id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: true, deleted: true, id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Cloudflare] Error deleting character ${id}:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to delete character',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
