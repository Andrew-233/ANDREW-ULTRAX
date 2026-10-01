const path = require('path');
const fs = require('fs');

/**
 * Single source of truth for on-disk locations.
 *
 * Previously ~15 modules used cwd-relative strings like './data/banned.json', so starting
 * the bot from any other directory (systemd without WorkingDirectory, pm2, `node /path/index.js`)
 * silently split state across two locations - settings appeared not to save.
 */
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TMP_DIR = path.join(ROOT, 'tmp');
const TEMP_DIR = path.join(ROOT, 'temp');
const STATUS_DIR = path.join(DATA_DIR, 'statuses');
const STORE_FILE = path.join(ROOT, 'baileys_store.json');
const SESSION_DIR = path.join(ROOT, 'session');
const CREDENTIALS_FILE = path.join(ROOT, 'Creds.json');
const BAILEYS_STORE_DIR = path.join(ROOT, 'baileys-store');
const LOGIN_FILE = path.join(SESSION_DIR, 'login.json');
const MESSAGE_BACKUP_FILE = path.join(ROOT, 'message_backup.json');
const SESSION_ERROR_FILE = path.join(ROOT, 'sessionErrorCount.json');

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

/** Read a JSON file, tolerating absence/emptiness/corruption. Never throws. */
function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, 'utf8');
    if (!txt.trim()) return fallback;
    return JSON.parse(txt);
  } catch (err) {
    // keep a copy so a corrupted store is diagnosable instead of silently reset
    try { fs.copyFileSync(file, `${file}.corrupt.${Date.now()}`); } catch (_) {}
    return fallback;
  }
}

/** Atomic write: full write to .tmp then rename. A kill mid-write can no longer truncate the store. */
function writeJsonAtomic(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error(`[storage] write failed for ${file}: ${err.message}`);
    return false;
  }
}

module.exports = {
  ROOT,
  DATA_DIR,
  TMP_DIR,
  TEMP_DIR,
  STATUS_DIR,
  STORE_FILE,
  SESSION_DIR,
  CREDENTIALS_FILE,
  BAILEYS_STORE_DIR,
  LOGIN_FILE,
  MESSAGE_BACKUP_FILE,
  SESSION_ERROR_FILE,
  dataFile,
  readJsonSafe,
  writeJsonAtomic
};
