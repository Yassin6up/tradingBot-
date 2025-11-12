import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Use SQLite database file (creates if doesn't exist)
// Supports env override for custom path or falls back to default
const dbPath = process.env.APP_DB_FILE || path.join(process.cwd(), 'data', 'app.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

try {
  sqlite = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  sqlite.pragma('journal_mode = WAL');
  
  // Create drizzle instance
  db = drizzle(sqlite, { schema });
  
  // Initialize tables programmatically
  initializeTables();
  
  console.log('✅ SQLite database initialized:', dbPath);
} catch (error) {
  console.error('❌ Failed to initialize SQLite database:', error);
  throw error;
}

function initializeTables() {
  // Create tables if they don't exist using raw SQL
  // This is a simple approach that works without drizzle-kit migrations
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      price TEXT NOT NULL,
      quantity TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      profit TEXT NOT NULL,
      profit_percent TEXT NOT NULL,
      strategy TEXT NOT NULL,
      mode TEXT NOT NULL
    );
  `);
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      initial_balance TEXT NOT NULL DEFAULT '10000',
      created_at INTEGER NOT NULL
    );
  `);
  
  console.log('✅ Database tables initialized');
}

export { db, sqlite };
