import { saveFullStateToDb } from '../../db.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const imported = await request.json();
    if (!imported || typeof imported !== 'object' || !imported.characters) {
      return new Response(JSON.stringify({ error: 'Invalid backup file format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const saved = await saveFullStateToDb(imported, env);
    return new Response(JSON.stringify({
      success: true,
      characterCount: Object.keys(saved.characters || {}).length,
      updatedAt: saved.updatedAt
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Cloudflare] Error importing backup to PostgreSQL:', err);
    return new Response(JSON.stringify({
      error: 'Failed to import backup to PostgreSQL',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
