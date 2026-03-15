import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { seedDefaults } from './seed.js';

// Use DB_PATH env var if set, otherwise resolve relative to packages/api/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../dev.db');
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

const sqlite = new Database(dbPath);
// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Run migrations then seed
try {
  migrate(db, { migrationsFolder });
  console.log('[db] Migrations applied successfully.');
} catch (err: any) {
  // If migrations are already applied, this is fine
  if (!err.message?.includes('already been applied')) {
    console.error('[db] Migration error:', err.message);
  }
}

// Seed default data
try {
  seedDefaults(db);
} catch (err: any) {
  console.error('[db] Seed error:', err.message);
}
