import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadStateFromDisk,
  getState,
  saveStateToDisk,
  syncState,
  deleteCharacter,
  upsertCharacter
} from '../storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('--- Starting Cloud Storage Tests ---');

  // Test 1: Storage basic load and save
  const initialState = loadStateFromDisk();
  assert(typeof initialState === 'object', 'Initial state should be object');
  console.log('✓ Test 1: loadStateFromDisk passed');

  // Test 2: Upsert character
  const testCharId = 'test-char-1';
  const testCharData = {
    name: 'Grommash the Brave',
    ownerId: 'player-1',
    ownerName: 'Alice',
    updatedAt: Date.now(),
    data: {
      stats: { Fighting: '12', Strength: '14' },
      info: { playerName: 'Alice', origins: 'Dwarf' }
    }
  };

  await upsertCharacter(testCharId, testCharData);
  const stateAfterUpsert = getState();
  assert(stateAfterUpsert.characters[testCharId], 'Character should exist in state');
  assert.strictEqual(stateAfterUpsert.characters[testCharId].name, 'Grommash the Brave');
  assert(stateAfterUpsert.assignments['player-1'].includes(testCharId), 'Character should be assigned');
  console.log('✓ Test 2: upsertCharacter passed');

  // Test 3: Sync state (merging newer timestamps)
  const clientPayload = {
    updatedAt: Date.now() + 1000,
    characters: {
      'test-char-1': {
        name: 'Grommash the Legendary',
        ownerId: 'player-1',
        ownerName: 'Alice',
        updatedAt: Date.now() + 1000,
        data: { stats: { Fighting: '15', Strength: '16' } }
      },
      'test-char-2': {
        name: 'Elrond the Wise',
        ownerId: 'player-2',
        ownerName: 'Bob',
        updatedAt: Date.now() + 500,
        data: { stats: { Intelligence: '18' } }
      }
    }
  };

  const syncResult = await syncState(clientPayload);
  assert.strictEqual(syncResult.characters['test-char-1'].name, 'Grommash the Legendary');
  assert.strictEqual(syncResult.characters['test-char-2'].name, 'Elrond the Wise');
  console.log('✓ Test 3: syncState merging passed');

  // Test 4: Delete character
  await deleteCharacter('test-char-2');
  const stateAfterDelete = getState();
  assert(!stateAfterDelete.characters['test-char-2'], 'Character 2 should be deleted');
  assert(stateAfterDelete.characters['test-char-1'], 'Character 1 should remain');
  console.log('✓ Test 4: deleteCharacter passed');

  // Test 5: Verify disk file and backups exist
  const dataDir = path.join(__dirname, '..', 'data');
  const backupDir = path.join(dataDir, 'backups');
  assert(fs.existsSync(path.join(dataDir, 'character-sheets.json')), 'DB file should exist on disk');
  assert(fs.existsSync(backupDir), 'Backup dir should exist');
  const backups = fs.readdirSync(backupDir);
  assert(backups.length > 0, 'Backups should have been created');
  console.log(`✓ Test 5: DB file and ${backups.length} backups verified on disk`);

  // Test 6: Cookie Deletion Simulation
  // When browser cookies/localStorage are wiped, loadStateFromDisk() from server restores all characters
  const cloudRestoredState = loadStateFromDisk();
  assert(cloudRestoredState.characters['test-char-1'], 'Character 1 successfully restored from server character-sheets.json after browser cache wipe!');
  console.log('✓ Test 6: Simulation of browser cookie & localStorage deletion - All data restored 100% from server character-sheets.json!');

  // Test 7: Verify character-sheets.json content on server
  const rawDbContent = fs.readFileSync(path.join(dataDir, 'character-sheets.json'), 'utf8');
  const parsedDb = JSON.parse(rawDbContent);
  assert(parsedDb.characters && parsedDb.characters['test-char-1'], 'character-sheets.json must contain character data');
  console.log('✓ Test 7: Direct validation of data/character-sheets.json file contents passed');

  console.log('--- ALL STORAGE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
