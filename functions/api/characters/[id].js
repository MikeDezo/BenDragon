import {
  getFullStateFromDb,
  upsertCharacterInDb,
  deleteCharacterFromDb,
  getConnectionString,
  query
} from '../../../db.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  if (!getConnectionString(env)) {
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

    if (res.rows.length === 0) {
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
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      updatedAt: Number(row.updatedAt) || Date.now(),
      data: charData || {}
    };

    return new Response(JSON.stringify({ character }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Cloudflare] Error getting character ${id}:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve character from PostgreSQL',
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

    if (getConnectionString(env)) {
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
    if (getConnectionString(env)) {
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
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Cloudflare] Error deleting character ${id}:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to delete character from PostgreSQL',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
