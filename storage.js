import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getD1Binding,
  isD1Configured,
  getConnectionString,
  getFullStateFromDb,
  saveFullStateToDb,
  syncStateWithDb,
  deleteCharacterFromDb,
  upsertCharacterInDb
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support custom data directory via environment variable (e.g. for persistent disks or local dev)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = process.env.DATA_PATH || path.join(DATA_DIR, 'character-sheets.json');
const MAX_BACKUPS = 15;

function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  } catch (e) {
    // In read-only or serverless environments, ignore directory creation errors
  }
}

function getDefaultState() {
  return {
    updatedAt: Date.now(),
    characters: {},
    assignments: {},
    rollHistory: [],
    initiativeTracker: {},
    knownPlayers: {}
  };
}

let cachedState = null;
let saveQueue = Promise.resolve();

export function isDbConfigured(env = {}) {
  return Boolean(getD1Binding(env) || getConnectionString(env));
}

export function isPostgresConfigured(env = {}) {
  return Boolean(getConnectionString(env));
}


function createBackup(data) {
  try {
    ensureDirectories();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `character-sheets-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf8');

    // Clean up old backups if exceeding MAX_BACKUPS
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('character-sheets-') && f.endsWith('.json'))
      .sort();

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, f));
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[CloudStorage] Failed to create backup:', err.message);
  }
}

function recoverFromLatestBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return null;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('character-sheets-') && f.endsWith('.json'))
      .sort();

    if (files.length === 0) return null;
    const latestBackup = path.join(BACKUP_DIR, files[files.length - 1]);
    const raw = fs.readFileSync(latestBackup, 'utf8');
    const parsed = JSON.parse(raw);
    console.log(`[CloudStorage] Successfully recovered data from backup: ${latestBackup}`);
    return parsed;
  } catch (err) {
    console.error('[CloudStorage] Failed to recover from backup:', err);
    return null;
  }
}

export function loadStateFromDisk() {
  ensureDirectories();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        cachedState = {
          characters: parsed.characters || {},
          assignments: parsed.assignments || {},
          rollHistory: Array.isArray(parsed.rollHistory) ? parsed.rollHistory : [],
          initiativeTracker: parsed.initiativeTracker || {},
          knownPlayers: parsed.knownPlayers || {},
          updatedAt: parsed.updatedAt || Date.now()
        };
        // Automatically transfer all loaded character sheets to D1 database
        if (isDbConfigured()) {
          saveFullStateToDb(cachedState).catch((err) => {
            console.warn('[Storage] Auto-sync to D1 failed:', err.message);
          });
        }
        return cachedState;
      }
    } catch (err) {
      console.error('[CloudStorage] Error reading DB file, attempting backup recovery:', err.message);
      const recovered = recoverFromLatestBackup();
      if (recovered) {
        cachedState = recovered;
        saveStateToDisk(cachedState);
        return cachedState;
      }
    }
  }

  // If no DB file exists yet, start with default empty state
  cachedState = getDefaultState();
  saveStateToDisk(cachedState);
  return cachedState;
}

export async function fetchState(env = {}) {
  if (isDbConfigured(env)) {
    try {
      let dbState = await getFullStateFromDb(env);
      if (!dbState.characters || Object.keys(dbState.characters).length === 0) {
        const diskState = getState();
        if (diskState?.characters && Object.keys(diskState.characters).length > 0) {
          await saveFullStateToDb(diskState, env);
          dbState = await getFullStateFromDb(env);
        }
      }
      cachedState = dbState;
      return dbState;
    } catch (err) {
      console.warn('[Storage] Database query failed, falling back to local state:', err.message);
    }
  }
  return getState();
}

export function getState() {
  if (!cachedState) {
    loadStateFromDisk();
  }
  return cachedState;
}

export async function saveStateToDisk(state, env = {}) {
  ensureDirectories();
  const payload = {
    updatedAt: state.updatedAt || Date.now(),
    characters: state.characters || {},
    assignments: state.assignments || {},
    rollHistory: Array.isArray(state.rollHistory) ? state.rollHistory.slice(0, 200) : [],
    initiativeTracker: state.initiativeTracker || {},
    knownPlayers: state.knownPlayers || {}
  };

  cachedState = payload;

  if (isDbConfigured(env)) {
    try {
      await saveFullStateToDb(payload, env);
    } catch (err) {
      console.warn('[Storage] Database save error:', err.message);
    }
  }

  saveQueue = saveQueue.then(async () => {
    try {
      const jsonStr = JSON.stringify(payload, null, 2);
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf8');
      fs.renameSync(tmpFile, DB_FILE);
      createBackup(payload);
    } catch (err) {
      if (err.code !== 'EROFS' && !err.message?.includes('read-only')) {
        console.warn('[Storage] Notice saving state to disk:', err.message);
      }
    }
  });

  return saveQueue;
}

export async function syncState(incomingState, deletedCharacterIds = [], env = {}) {
  if (isDbConfigured(env)) {
    try {
      const dbMerged = await syncStateWithDb(incomingState, deletedCharacterIds, env);
      cachedState = dbMerged;
      saveStateToDisk(dbMerged).catch(() => {});
      return dbMerged;
    } catch (err) {
      console.warn('[Storage] Database sync failed, using in-memory / disk sync:', err.message);
    }
  }

  const current = getState();
  const merged = {
    updatedAt: Math.max(current.updatedAt || 0, incomingState.updatedAt || 0, Date.now()),
    characters: { ...current.characters },
    assignments: { ...current.assignments, ...(incomingState.assignments || {}) },
    initiativeTracker: { ...current.initiativeTracker, ...(incomingState.initiativeTracker || {}) },
    knownPlayers: { ...(current.knownPlayers || {}), ...(incomingState.knownPlayers || {}) },
    rollHistory: []
  };

  // Process explicitly deleted characters
  if (Array.isArray(deletedCharacterIds)) {
    for (const dId of deletedCharacterIds) {
      delete merged.characters[dId];
      // Also clean up assignments
      Object.keys(merged.assignments).forEach((ownerId) => {
        if (Array.isArray(merged.assignments[ownerId])) {
          merged.assignments[ownerId] = merged.assignments[ownerId].filter((id) => id !== dId);
        }
      });
    }
  }

  // Merge characters by timestamp
  const inChars = incomingState.characters || {};
  const allCharIds = new Set([
    ...Object.keys(merged.characters),
    ...Object.keys(inChars)
  ]);

  allCharIds.forEach((id) => {
    if (Array.isArray(deletedCharacterIds) && deletedCharacterIds.includes(id)) {
      return;
    }
    const cChar = merged.characters[id];
    const iChar = inChars[id];
    if (cChar && iChar) {
      const cTime = cChar.updatedAt || current.updatedAt || 0;
      const iTime = iChar.updatedAt || incomingState.updatedAt || 0;
      merged.characters[id] = iTime >= cTime ? iChar : cChar;
    } else if (iChar) {
      merged.characters[id] = iChar;
    }
  });

  // Re-verify assignments
  const newAssignments = {};
  Object.entries(merged.characters).forEach(([cId, c]) => {
    if (c.ownerId) {
      newAssignments[c.ownerId] ??= [];
      if (!newAssignments[c.ownerId].includes(cId)) {
        newAssignments[c.ownerId].push(cId);
      }
    }
  });
  merged.assignments = newAssignments;

  // Merge roll histories deduplicating by ID
  const historyMap = new Map();
  (current.rollHistory || []).forEach((r) => { if (r && r.id) historyMap.set(r.id, r); });
  (incomingState.rollHistory || []).forEach((r) => { if (r && r.id) historyMap.set(r.id, r); });
  merged.rollHistory = Array.from(historyMap.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 200);

  await saveStateToDisk(merged);
  return merged;
}

export async function deleteCharacter(characterId, env = {}) {
  if (isDbConfigured(env)) {
    try {
      const deleted = await deleteCharacterFromDb(characterId, env);
      if (deleted && cachedState?.characters) {
        delete cachedState.characters[characterId];
        Object.keys(cachedState.assignments || {}).forEach((ownerId) => {
          if (Array.isArray(cachedState.assignments[ownerId])) {
            cachedState.assignments[ownerId] = cachedState.assignments[ownerId].filter((id) => id !== characterId);
          }
        });
        if (cachedState.initiativeTracker && cachedState.initiativeTracker[characterId]) {
          delete cachedState.initiativeTracker[characterId];
        }
      }
      await saveStateToDisk(cachedState || getState());
      return deleted;
    } catch (err) {
      console.warn('[Storage] Database delete failed, using disk delete:', err.message);
    }
  }

  const current = getState();
  if (current.characters[characterId]) {
    delete current.characters[characterId];
    current.updatedAt = Date.now();

    // Clean assignments
    Object.keys(current.assignments).forEach((ownerId) => {
      if (Array.isArray(current.assignments[ownerId])) {
        current.assignments[ownerId] = current.assignments[ownerId].filter((id) => id !== characterId);
      }
    });

    // Clean initiative tracker
    if (current.initiativeTracker && current.initiativeTracker[characterId]) {
      delete current.initiativeTracker[characterId];
    }

    await saveStateToDisk(current);
    return true;
  }
  return false;
}

export async function upsertCharacter(characterId, characterData, env = {}) {
  if (isDbConfigured(env)) {
    try {
      const saved = await upsertCharacterInDb(characterId, characterData, env);
      if (cachedState?.characters) {
        cachedState.characters[characterId] = saved;
        if (characterData.ownerId) {
          cachedState.assignments ??= {};
          cachedState.assignments[characterData.ownerId] ??= [];
          if (!cachedState.assignments[characterData.ownerId].includes(characterId)) {
            cachedState.assignments[characterData.ownerId].push(characterId);
          }
        }
      }
      await saveStateToDisk(cachedState || getState());
      return saved;
    } catch (err) {
      console.warn('[Storage] Database upsert failed, using disk upsert:', err.message);
    }
  }

  const current = getState();
  current.characters[characterId] = {
    ...characterData,
    updatedAt: characterData.updatedAt || Date.now()
  };
  current.updatedAt = Date.now();

  if (characterData.ownerId) {
    current.assignments ??= {};
    current.assignments[characterData.ownerId] ??= [];
    if (!current.assignments[characterData.ownerId].includes(characterId)) {
      current.assignments[characterData.ownerId].push(characterId);
    }
  }

  await saveStateToDisk(current);
  return current.characters[characterId];
}

