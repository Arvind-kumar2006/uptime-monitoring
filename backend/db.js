const Database = require('better-sqlite3');
const path = require('path');

// SQLite file lives in a mounted volume so data survives container restarts
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'monitor.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    is_up INTEGER NOT NULL,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_checks_url_id_checked_at
    ON checks (url_id, checked_at DESC);
`);

module.exports = db;
