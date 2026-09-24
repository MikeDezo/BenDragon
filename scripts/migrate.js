import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDb,
  isD1Configured,
  getD1Binding,
  saveFullStateToDb,
  getFullStateFromDb,
  getConnectionString
} from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 Ben & Dragon! Cloudflare D1 (bendragonDB) Migration Tool');
  console.log('====================================================\n');

  const d1 = getD1Binding();
  const isPostgres = Boolean(getConnectionString());

  if (d1) {
    console.log('📡 Engine: Cloudflare D1 / SQLite (bendragonDB)');
  } else if (isPostgres) {
    console.log('📡 Engine: PostgreSQL');
  } else {
    console.log('📡 Engine: Local SQLite Database');
  }

  try {
    // 1. Initialize schema
    console.log('⏳ Initializing database tables and indexes...');
    await initDb();
    console.log('✅ Database schema initialized successfully.');

    // 2. Check if database already has characters
    const currentState = await getFullStateFromDb();
    const existingCount = Object.keys(currentState.characters || {}).length;
    console.log(`📊 Existing characters in database: ${existingCount}`);

    // 3. Check for local data/character-sheets.json to migrate
    const jsonPath = path.join(__dirname, '..', 'data', 'character-sheets.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const localData = JSON.parse(raw);
        const localCharCount = Object.keys(localData.characters || {}).length;

        if (localCharCount > 0) {
          console.log(`\n📦 Found ${localCharCount} character(s) in data/character-sheets.json.`);
          console.log('⏳ Migrating character sheets into database...');

          await saveFullStateToDb(localData);

          const updatedState = await getFullStateFromDb();
          const newCount = Object.keys(updatedState.characters || {}).length;
          console.log(`✅ Successfully migrated! Database now has ${newCount} character sheets.`);
        }
      } catch (err) {
        console.warn('⚠️ Could not parse local character-sheets.json:', err.message);
      }
    }

    console.log('\n🎉 Database setup & migration complete!');
    console.log('Cloudflare D1 binding: bendragonDB (Worker: bendragon)');
    console.log('To apply remote D1 migrations: npx wrangler d1 migrations apply bendragonDB --remote\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();

