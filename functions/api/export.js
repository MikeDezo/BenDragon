import { getFullStateFromDb, getD1Binding, getConnectionString } from '../../db.js';

export async function onRequestGet(context) {
  const { env } = context;
  const dateStr = new Date().toISOString().slice(0, 10);
  try {
    let state = {
      updatedAt: Date.now(),
      characters: {},
      assignments: {},
      rollHistory: [],
      initiativeTracker: {},
      knownPlayers: {}
    };

    if (getD1Binding(env) || getConnectionString(env)) {
      try {
        state = await getFullStateFromDb(env);
      } catch (dbErr) {
        console.warn('[Pages Functions] Export DB query warning:', dbErr.message);
      }
    }

    return new Response(JSON.stringify(state, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="terranova-characters-${dateStr}.json"`
      }
    });
  } catch (err) {
    console.error('[Cloudflare] Error exporting data:', err);
    return new Response(JSON.stringify({
      error: 'Failed to export backup',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

