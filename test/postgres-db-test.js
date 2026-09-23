import assert from 'assert';
import 'dotenv/config';
import {
  initDb,
  getConnectionString,
  getFullStateFromDb,
  saveFullStateToDb,
  syncStateWithDb,
  upsertCharacterInDb,
  deleteCharacterFromDb
} from '../db.js';

async function runPostgresTests() {
  console.log('--- Starting PostgreSQL Integration Tests ---');

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.log('ℹ️ DATABASE_URL not detected in environment. Skipping live PostgreSQL test.');
    console.log('To run live DB tests, set DATABASE_URL in .env or environment.');
    return;
  }

  console.log('Testing live PostgreSQL connection...');
  await initDb();
  console.log('✓ Test 1: initDb passed');

  const testId = `test-pg-${Date.now()}`;
  const char = {
    name: 'Valeros the Fighter',
    ownerId: 'player-pg-1',
    ownerName: 'Valeros',
    updatedAt: Date.now(),
    data: {
      stats: { Strength: '18', Dexterity: '14' },
      info: { class: 'Warrior' }
    }
  };

  const saved = await upsertCharacterInDb(testId, char);
  assert.strictEqual(saved.name, 'Valeros the Fighter');
  console.log('✓ Test 2: upsertCharacterInDb passed');

  const fullState = await getFullStateFromDb();
  assert(fullState.characters[testId], 'Character should exist in fullState');
  assert.strictEqual(fullState.characters[testId].name, 'Valeros the Fighter');
  console.log('✓ Test 3: getFullStateFromDb passed');

  // Test sync
  const syncPayload = {
    updatedAt: Date.now() + 100,
    characters: {
      [testId]: {
        ...char,
        name: 'Valeros the Champion',
        updatedAt: Date.now() + 100
      }
    }
  };
  const synced = await syncStateWithDb(syncPayload);
  assert.strictEqual(synced.characters[testId].name, 'Valeros the Champion');
  console.log('✓ Test 4: syncStateWithDb passed');

  // Clean up
  await deleteCharacterFromDb(testId);
  const stateAfterDelete = await getFullStateFromDb();
  assert(!stateAfterDelete.characters[testId], 'Character should be deleted');
  console.log('✓ Test 5: deleteCharacterFromDb passed');

  console.log('--- ALL POSTGRESQL TESTS PASSED SUCCESSFULLY! ---');
}

runPostgresTests().catch((err) => {
  console.error('PostgreSQL test failed:', err);
  process.exit(1);
});
