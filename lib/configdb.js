const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'config.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

function setConfig(key, value) {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  stmt.run(key, String(value));
  return true;
}

function getConfig(key, defaultValue = null) {
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : defaultValue;
}

function deleteConfig(key) {
  const stmt = db.prepare('DELETE FROM config WHERE key = ?');
  stmt.run(key);
  return true;
}

function getAllConfig() {
  const stmt = db.prepare('SELECT key, value FROM config');
  const rows = stmt.all();
  const config = {};
  rows.forEach(row => {
    config[row.key] = row.value;
  });
  return config;
}

module.exports = {
  setConfig,
  getConfig,
  deleteConfig,
  getAllConfig,
  db
};
