import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDb,
  getConnectionString,
  saveFullStateToDb,
  getFullStateFromDb,
  query
} from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 Ben & Dragon! PostgreSQL Migration & Seed Tool');
  console.log('====================================================\n');

  const connectionString = getConnectionString();

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL or POSTGRES_URL is not configured.');
    console.error('Please set DATABASE_URL in your environment or in a .env file:');
    console.error('Example: DATABASE_URL="postgres://username:password@hostname:5432/dbname?sslmode=require"\n');
    process.exit(1);
  }

  // Mask credentials for display
  const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log(`📡 Connecting to PostgreSQL: ${masked}`);

  try {
    // 1. Initialize schema
    console.log('⏳ Initializing database tables and indexes...');
    await initDb();
    console.log('✅ PostgreSQL schema initialized successfully.');

    // 2. Check if database already has characters
    const currentState = await getFullStateFromDb();
    const existingCount = Object.keys(currentState.characters || {}).length;
    console.log(`📊 Existing characters in PostgreSQL: ${existingCount}`);

    // 3. Check for local data/character-sheets.json to migrate
    const jsonPath = path.join(__dirname, '..', 'data', 'character-sheets.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const localData = JSON.parse(raw);
        const localCharCount = Object.keys(localData.characters || {}).length;

        if (localCharCount > 0) {
          console.log(`\n📦 Found ${localCharCount} character(s) in data/character-sheets.json.`);
          console.log('⏳ Migrating local character sheets into PostgreSQL...');

          await saveFullStateToDb(localData);

          const updatedState = await getFullStateFromDb();
          const newCount = Object.keys(updatedState.characters || {}).length;
          console.log(`✅ Successfully migrated! PostgreSQL now has ${newCount} character sheets.`);
        }
      } catch (err) {
        console.warn('⚠️ Could not parse local character-sheets.json:', err.message);
      }
    }

    console.log('\n🎉 Database setup & migration complete!');
    console.log('You can now deploy to Cloudflare Pages or run locally with PostgreSQL.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
