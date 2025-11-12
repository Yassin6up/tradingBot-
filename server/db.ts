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
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT NOT NULL DEFAULT 'binance',
      api_key TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
      created_at INTEGER NOT NULL,
      trading_mode TEXT NOT NULL DEFAULT 'paper',
      real_balance TEXT DEFAULT '0',
      real_balance_updated_at INTEGER,
      real_mode_confirmed_at INTEGER,
      real_mode_enabled_by TEXT,
      max_position_size TEXT DEFAULT '1000',
      daily_loss_limit TEXT DEFAULT '500'
    );
  `);
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      entry_price TEXT NOT NULL,
      quantity TEXT NOT NULL,
      stop_loss TEXT NOT NULL,
      take_profit TEXT NOT NULL,
      trailing_stop TEXT,
      mode TEXT NOT NULL,
      strategy TEXT NOT NULL,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER
    );
  `);
  
  // Migrate legacy 'sandbox' mode to 'paper' mode in existing trades
  try {
    sqlite.exec(`UPDATE trades SET mode = 'paper' WHERE mode = 'sandbox'`);
  } catch (e) {
    // Ignore if table doesn't exist yet or no rows affected
  }
  
  // Migrate existing portfolio_settings table if it exists (add new columns)
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN trading_mode TEXT NOT NULL DEFAULT 'paper'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN real_balance TEXT DEFAULT '0'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN real_balance_updated_at INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN real_mode_confirmed_at INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN real_mode_enabled_by TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN max_position_size TEXT DEFAULT '1000'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    sqlite.exec(`ALTER TABLE portfolio_settings ADD COLUMN daily_loss_limit TEXT DEFAULT '500'`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  console.log('✅ Database tables initialized');
}

export { db, sqlite };
