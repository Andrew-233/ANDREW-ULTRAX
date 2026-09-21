const path = require('path');
const fs = require('fs');
const { dataFile, readJsonSafe, writeJsonAtomic } = require('./paths');

// `better-sqlite3` is a NATIVE module that this repo never declared in package.json, so it is
// not installed. Requiring it at module scope threw MODULE_NOT_FOUND, and because
// commands/grouptime.js lazily requires ./setbot (which requires this file), that made `.grouptime`
// fail at call time - a crash that no syntax check would ever have shown.
//
// The sqlite backend is still used when someone does install the package; otherwise the exact same
// key/value API is served from data/config.json through the shared atomic-write helper.
const CONFIG_JSON = dataFile('config.json');

let db = null;
let setConfig, getConfig, deleteConfig, getAllConfig;

try {
  const Database = require('better-sqlite3');
  const dbDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  db = new Database(path.join(dbDir, 'config.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  setConfig = (key, value) => {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
    return true;
  };
  getConfig = (key, defaultValue = null) => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  };
  deleteConfig = (key) => {
    db.prepare('DELETE FROM config WHERE key = ?').run(key);
    return true;
  };
  getAllConfig = () => {
    const config = {};
    for (const row of db.prepare('SELECT key, value FROM config').all()) config[row.key] = row.value;
    return config;
  };
} catch (err) {
  if (err && err.code !== 'MODULE_NOT_FOUND') {
    // a broken/incompatible native build should be visible, not silently downgraded
    console.error('[configdb] sqlite backend unusable, using data/config.json instead:', err.message);
  }
  db = null;

  const read = () => {
    const obj = readJsonSafe(CONFIG_JSON, {});
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  };

  setConfig = (key, value) => {
    const cfg = read();
    cfg[key] = String(value);
    return writeJsonAtomic(CONFIG_JSON, cfg);
  };
  getConfig = (key, defaultValue = null) => {
    const cfg = read();
    return Object.prototype.hasOwnProperty.call(cfg, key) ? cfg[key] : defaultValue;
  };
  deleteConfig = (key) => {
    const cfg = read();
    if (!(key in cfg)) return true;
    delete cfg[key];
    return writeJsonAtomic(CONFIG_JSON, cfg);
  };
  getAllConfig = read;
}

module.exports = {
  setConfig,
  getConfig,
  deleteConfig,
  getAllConfig,
  get db() { return db; },
  get backend() { return db ? 'sqlite' : 'json'; },
};
