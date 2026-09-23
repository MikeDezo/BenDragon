import { getFullStateFromDb } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const state = await getFullStateFromDb(env);
    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(state, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="terranova-characters-${dateStr}.json"`
      }
    });
  } catch (err) {
    console.error('[Cloudflare] Error exporting data from PostgreSQL:', err);
    return new Response(JSON.stringify({
      error: 'Failed to export backup from PostgreSQL',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
