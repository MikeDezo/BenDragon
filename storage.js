import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support custom data directory via environment variable (e.g. for Render persistent disks)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = process.env.DATA_PATH || path.join(DATA_DIR, 'character-sheets.json');
const MAX_BACKUPS = 15;

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
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

export function getState() {
  if (!cachedState) {
    loadStateFromDisk();
  }
  return cachedState;
}

export async function saveStateToDisk(state) {
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

  saveQueue = saveQueue.then(async () => {
    try {
      const jsonStr = JSON.stringify(payload, null, 2);
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf8');
      fs.renameSync(tmpFile, DB_FILE);
      createBackup(payload);
    } catch (err) {
      console.error('[CloudStorage] Failed to save state to disk:', err);
      throw err;
    }
  });

  return saveQueue;
}

export async function syncState(incomingState, deletedCharacterIds = []) {
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

export async function deleteCharacter(characterId) {
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

export async function upsertCharacter(characterId, characterData) {
  const current = getState();
  current.characters[characterId] = {
    ...characterData,
    updatedAt: characterData.updatedAt || Date.now()
  };
  current.updatedAt = Date.now();

  if (characterData.ownerId) {
    current.assignments[characterData.ownerId] ??= [];
    if (!current.assignments[characterData.ownerId].includes(characterId)) {
      current.assignments[characterData.ownerId].push(characterId);
    }
  }

  await saveStateToDisk(current);
  return current.characters[characterId];
}
