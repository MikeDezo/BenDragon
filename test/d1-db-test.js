import assert from 'node:assert';
import 'dotenv/config';
import {
  initDb,
  getD1Binding,
  isD1Configured,
  getFullStateFromDb,
  saveFullStateToDb,
  syncStateWithDb,
  upsertCharacterInDb,
  deleteCharacterFromDb
} from '../db.js';

async function runD1Tests() {
  console.log('==============================================');
  console.log('🧪 Starting Cloudflare D1 / SQLite Tests');
  console.log('==============================================\n');

  // 1. Initialize schema
  await initDb();
  console.log('✓ Test 1: initDb passed');

  // 2. Test upsert character
  const testId = `test-d1-${Date.now()}`;
  const char = {
    id: testId,
    name: 'Borealis Champion',
    ownerId: 'player-d1-1',
    ownerName: 'Arthur',
    updatedAt: Date.now(),
    data: {
      stats: { Fighting: '18', Strength: '16', Agility: '14' },
      info: { playerName: 'Arthur', name: 'Borealis Champion' },
      tables: {
        Weapons: [{ 0: 'Épée Runique', 1: 'Épée de boréalis', 9: '2D6' }],
        Skills: [['Acrobaties', 'Combat', 'Agility']]
      }
    }
  };

  const saved = await upsertCharacterInDb(testId, char);
  assert.strictEqual(saved.name, 'Borealis Champion', 'Saved character name must match');
  assert.strictEqual(saved.ownerId, 'player-d1-1', 'Saved ownerId must match');
  console.log('✓ Test 2: upsertCharacterInDb passed');

  // 3. Test getFullState
  const fullState = await getFullStateFromDb();
  assert(fullState.characters[testId], 'Character should exist in fullState');
  assert.strictEqual(fullState.characters[testId].name, 'Borealis Champion');
  assert(Array.isArray(fullState.assignments['player-d1-1']), 'Player assignments must be an array');
  assert(fullState.assignments['player-d1-1'].includes(testId), 'Assignment must include character id');
  console.log('✓ Test 3: getFullStateFromDb passed (characters & assignments verified)');

  // 4. Test delta sync with timestamp conflict resolution
  const newerTime = Date.now() + 500;
  const syncPayload = {
    updatedAt: newerTime,
    characters: {
      [testId]: {
        ...char,
        name: 'Borealis Grand Champion',
        updatedAt: newerTime
      }
    },
    initiativeTracker: {
      [testId]: { roll: 18, round: 1 }
    },
    knownPlayers: {
      'player-d1-1': { id: 'player-d1-1', name: 'Arthur', role: 'GM' }
    },
    rollHistory: [
      {
        id: `roll-${Date.now()}`,
        characterId: testId,
        characterName: 'Borealis Grand Champion',
        timestamp: newerTime,
        statName: 'Fighting',
        diceResult: 85
      }
    ]
  };

  const synced = await syncStateWithDb(syncPayload);
  assert.strictEqual(synced.characters[testId].name, 'Borealis Grand Champion', 'Name should be updated after sync');
  assert.strictEqual(synced.initiativeTracker[testId]?.roll, 18, 'Initiative tracker should be synced');
  assert(synced.rollHistory.some((r) => r.characterId === testId), 'Roll history should include roll');
  console.log('✓ Test 4: syncStateWithDb passed (characters, initiative, rollHistory)');

  // 5. Test character deletion
  const deleteResult = await deleteCharacterFromDb(testId);
  assert(deleteResult, 'Delete result should be true');

  const stateAfterDelete = await getFullStateFromDb();
  assert(!stateAfterDelete.characters[testId], 'Character should not exist after deletion');
  assert(!stateAfterDelete.assignments['player-d1-1']?.includes(testId), 'Character should be removed from assignments');
  assert(!stateAfterDelete.initiativeTracker[testId], 'Character should be removed from initiative tracker');
  console.log('✓ Test 5: deleteCharacterFromDb passed (cascade cleaned assignments & tracker)');

  // 6. Test full backup state save
  const backupState = {
    updatedAt: Date.now(),
    characters: {
      'backup-char-1': {
        id: 'backup-char-1',
        name: 'Mage Aurorien',
        ownerId: 'player-mage',
        ownerName: 'Merlin',
        updatedAt: Date.now(),
        data: {
          stats: { Psyche: '20', Intelligence: '18' }
        }
      }
    },
    assignments: {
      'player-mage': ['backup-char-1']
    },
    initiativeTracker: {},
    knownPlayers: {},
    rollHistory: []
  };

  const restored = await saveFullStateToDb(backupState);
  assert(restored.characters['backup-char-1'], 'Backup character should exist');
  assert.strictEqual(restored.characters['backup-char-1'].name, 'Mage Aurorien');
  console.log('✓ Test 6: saveFullStateToDb passed (full backup save)');

  // 7. Test automatic transfer / seeding of character-sheets.json into D1
  const d1State = await getFullStateFromDb();
  assert(d1State.characters['58a4ce8f-fcd3-4535-b35d-a62e2deb3624'], 'Wendigo should be auto-transferred into D1');
  assert.strictEqual(d1State.characters['58a4ce8f-fcd3-4535-b35d-a62e2deb3624'].name, 'Wendigo');
  assert(d1State.characters['58a4ce8f-fcd3-4535-b35d-a62e2deb3624'].data?.tables?.Skills?.length > 0, 'Skills table should be preserved');
  assert(d1State.characters['7d9474f7-d9fe-4a3c-baf9-330dc96dccee'], 'Lancelot Dupont should be auto-transferred into D1');
  assert(d1State.characters['89a1a365-c9ac-48c5-95ce-a0150b6f72c4'], 'Octavius Du-Grand-Sault should be auto-transferred into D1');
  console.log(`✓ Test 7: Automatic transfer of character-sheets.json into D1 verified (${Object.keys(d1State.characters).length} characters stored in D1)`);

  console.log('\n🎉 ALL CLOUDFLARE D1 / SQLITE TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runD1Tests().catch((err) => {
  console.error('❌ D1 test failed:', err);
  process.exit(1);
});
