import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  loadStateFromDisk,
  getState,
  fetchState,
  saveStateToDisk,
  syncState,
  deleteCharacter,
  upsertCharacter,
  isPostgresConfigured,
  isDbConfigured
} from './storage.js';
import { initDb, saveFullStateToDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Load persisted state from disk at startup and automatically sync all data into D1 SQL database
const startupState = loadStateFromDisk();
(async () => {
  try {
    await initDb();
    if (startupState && Object.keys(startupState.characters || {}).length > 0) {
      await saveFullStateToDb(startupState);
      console.log(`[Server] Automatically transferred ${Object.keys(startupState.characters).length} character(s) from character-sheets.json into D1 database.`);
    }
  } catch (err) {
    console.warn('[Server] Automatic D1 synchronization notice:', err.message);
  }
})();

// Enable CORS for Owlbear Rodeo and all clients
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Body parsing with large limit for extensive character sheet data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// Anti-Caching Middleware: Character sheets must NEVER be stored in browser cache
// ----------------------------------------------------
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// ----------------------------------------------------
// Cloud Storage API Routes
// ----------------------------------------------------

// Health check endpoint (for Render / Cloudflare health checks)
app.get('/api/health', async (req, res) => {
  try {
    const state = await fetchState();
    const charCount = Object.keys(state.characters || {}).length;
    res.json({
      status: 'ok',
      database: isPostgresConfigured() ? 'PostgreSQL' : 'Local Disk',
      uptime: Math.floor(process.uptime()),
      characterCount: charCount,
      updatedAt: state.updatedAt || null,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Get all character sheets and full state
app.get(['/api/character-sheets', '/api/state'], async (req, res) => {
  try {
    const state = await fetchState();
    res.json(state);
  } catch (err) {
    console.error('[API] Error getting state:', err);
    res.status(500).json({ error: 'Failed to retrieve character sheets' });
  }
});

// Save / replace full state
app.post(['/api/character-sheets', '/api/state'], async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Invalid state payload' });
    }
    await saveStateToDisk(incoming);
    const updated = await fetchState();
    res.json({
      success: true,
      updatedAt: updated.updatedAt,
      characterCount: Object.keys(updated.characters || {}).length
    });
  } catch (err) {
    console.error('[API] Error saving state:', err);
    res.status(500).json({ error: 'Failed to save character sheets' });
  }
});

// Smart sync endpoint (merges timestamps, handles deleted characters)
app.post('/api/sync', async (req, res) => {
  try {
    const { deletedCharacterIds, ...incomingState } = req.body || {};
    const merged = await syncState(incomingState, deletedCharacterIds || []);
    res.json({
      success: true,
      state: merged,
      serverTime: Date.now()
    });
  } catch (err) {
    console.error('[API] Error syncing state:', err);
    res.status(500).json({ error: 'Failed to sync character sheets' });
  }
});

// Get a single character by ID
app.get('/api/characters/:id', async (req, res) => {
  try {
    const state = await fetchState();
    const character = state.characters?.[req.params.id];
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    res.json({ character });
  } catch (err) {
    console.error('[API] Error getting character:', err);
    res.status(500).json({ error: 'Failed to retrieve character' });
  }
});

// Upsert a single character
app.put('/api/characters/:id', async (req, res) => {
  try {
    const characterData = req.body;
    if (!characterData || typeof characterData !== 'object') {
      return res.status(400).json({ error: 'Invalid character data' });
    }
    const saved = await upsertCharacter(req.params.id, characterData);
    res.json({ success: true, character: saved });
  } catch (err) {
    console.error('[API] Error updating character:', err);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

app.post('/api/characters/:id', async (req, res) => {
  try {
    const characterData = req.body;
    if (!characterData || typeof characterData !== 'object') {
      return res.status(400).json({ error: 'Invalid character data' });
    }
    const saved = await upsertCharacter(req.params.id, characterData);
    res.json({ success: true, character: saved });
  } catch (err) {
    console.error('[API] Error creating character:', err);
    res.status(500).json({ error: 'Failed to save character' });
  }
});

// Delete a single character
app.delete('/api/characters/:id', async (req, res) => {
  try {
    const deleted = await deleteCharacter(req.params.id);
    res.json({ success: true, deleted, id: req.params.id });
  } catch (err) {
    console.error('[API] Error deleting character:', err);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// Export full backup as downloadable JSON
app.get('/api/export', async (req, res) => {
  try {
    const state = await fetchState();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="terranova-characters-${dateStr}.json"`);
    res.send(JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[API] Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export backup' });
  }
});

// Import full state backup
app.post('/api/import', async (req, res) => {
  try {
    const imported = req.body;
    if (!imported || typeof imported !== 'object' || !imported.characters) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }
    await saveStateToDisk(imported);
    const updated = await fetchState();
    res.json({
      success: true,
      characterCount: Object.keys(updated.characters || {}).length,
      updatedAt: updated.updatedAt
    });
  } catch (err) {
    console.error('[API] Error importing backup:', err);
    res.status(500).json({ error: 'Failed to import backup' });
  }
});

// ----------------------------------------------------
// Static Files & Web Hosting for Extension
// ----------------------------------------------------

const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

const setNoCacheHeaders = (res, filePath) => {
  // Never cache HTML files or dynamic resources in the player's browser
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
};

// Serve static assets from dist if built, otherwise public/root
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { setHeaders: setNoCacheHeaders }));
} else {
  app.use(express.static(publicPath, { setHeaders: setNoCacheHeaders }));
  app.use(express.static(__dirname, { setHeaders: setNoCacheHeaders }));
}

// Extension entry routes
app.get('/character-sheet.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  const file = fs.existsSync(path.join(distPath, 'character-sheet.html'))
    ? path.join(distPath, 'character-sheet.html')
    : path.join(__dirname, 'character-sheet.html');
  res.sendFile(file);
});

app.get('/manifest.json', (req, res) => {
  const file = fs.existsSync(path.join(distPath, 'manifest.json'))
    ? path.join(distPath, 'manifest.json')
    : fs.existsSync(path.join(publicPath, 'manifest.json'))
      ? path.join(publicPath, 'manifest.json')
      : path.join(__dirname, 'manifest.json');
  res.sendFile(file);
});

// Fallback to character-sheet.html for any remaining non-API requests
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  const file = fs.existsSync(path.join(distPath, 'character-sheet.html'))
    ? path.join(distPath, 'character-sheet.html')
    : path.join(__dirname, 'character-sheet.html');
  res.sendFile(file);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(` BenDragon Cloud Extension Server Ready `);
  console.log(` Listening on port: ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` API endpoint: http://localhost:${PORT}/api/character-sheets`);
  console.log(`========================================`);
});
