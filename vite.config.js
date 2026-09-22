import { defineConfig } from "vite";
import {
  loadStateFromDisk,
  getState,
  saveStateToDisk,
  syncState,
  deleteCharacter,
  upsertCharacter
} from './storage.js';

function cloudStorageDevPlugin() {
  return {
    name: 'cloud-storage-dev-api',
    configureServer(server) {
      loadStateFromDisk();

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        if (!pathname.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const readJsonBody = () => new Promise((resolve, reject) => {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (err) {
              reject(err);
            }
          });
          req.on('error', reject);
        });

        try {
          if (pathname === '/api/health' && req.method === 'GET') {
            const state = getState();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              status: 'ok',
              characterCount: Object.keys(state.characters || {}).length,
              timestamp: Date.now()
            }));
          }

          if ((pathname === '/api/character-sheets' || pathname === '/api/state') && req.method === 'GET') {
            const state = getState();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(state));
          }

          if ((pathname === '/api/character-sheets' || pathname === '/api/state') && req.method === 'POST') {
            const body = await readJsonBody();
            await saveStateToDisk(body);
            const state = getState();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              updatedAt: state.updatedAt,
              characterCount: Object.keys(state.characters || {}).length
            }));
          }

          if (pathname === '/api/sync' && req.method === 'POST') {
            const body = await readJsonBody();
            const { deletedCharacterIds, ...incomingState } = body || {};
            const merged = await syncState(incomingState, deletedCharacterIds || []);
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              state: merged,
              serverTime: Date.now()
            }));
          }

          if (pathname.startsWith('/api/characters/')) {
            const charId = pathname.replace('/api/characters/', '');
            if (req.method === 'GET') {
              const state = getState();
              const char = state.characters?.[charId];
              if (!char) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Character not found' }));
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ character: char }));
            }

            if (req.method === 'PUT' || req.method === 'POST') {
              const body = await readJsonBody();
              const saved = await upsertCharacter(charId, body);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, character: saved }));
            }

            if (req.method === 'DELETE') {
              const deleted = await deleteCharacter(charId);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, deleted, id: charId }));
            }
          }

          if (pathname === '/api/export' && req.method === 'GET') {
            const state = getState();
            const dateStr = new Date().toISOString().slice(0, 10);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="terranova-characters-${dateStr}.json"`);
            return res.end(JSON.stringify(state, null, 2));
          }

          if (pathname === '/api/import' && req.method === 'POST') {
            const body = await readJsonBody();
            if (!body || typeof body !== 'object' || !body.characters) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Invalid backup format' }));
            }
            await saveStateToDisk(body);
            const state = getState();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              characterCount: Object.keys(state.characters || {}).length,
              updatedAt: state.updatedAt
            }));
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'API route not found' }));
        } catch (err) {
          console.error('[ViteDevAPI] Error handling API request:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Internal server error', message: err.message }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [cloudStorageDevPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        characterSheet: "character-sheet.html",
      },
    },
  },
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
});