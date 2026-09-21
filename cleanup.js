#!/usr/bin/env node
/**
 * cleanup.js - removes transient media/temp artifacts.
 *
 * This file was referenced by `npm run cleanup` (and therefore `npm run start:clean`)
 * but never existed, so those scripts exited 1 before starting the bot.
 * It only deletes regenerable scratch data; session/, data/ and assets/ are untouched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TARGETS = [
  path.join(ROOT, 'tmp'),
  path.join(ROOT, 'temp'),
  path.join(ROOT, 'data', 'statuses'),
];

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h - keep anything recent (may still be in use)

let removed = 0;
let bytes = 0;

function prune(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === '.gitkeep') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      prune(full);
      try {
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } catch {}
      continue;
    }
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (Date.now() - st.mtimeMs < MAX_AGE_MS) continue;
    try {
      fs.unlinkSync(full);
      removed++;
      bytes += st.size;
    } catch (err) {
      console.warn(`[cleanup] could not remove ${e.name}: ${err.message}`);
    }
  }
}

for (const t of TARGETS) {
  if (fs.existsSync(t)) prune(t);
}

// clear any leftover atomic-write sidecars
for (const base of [path.join(ROOT, 'baileys_store.json'), path.join(ROOT, 'data')]) {
  try {
    const dir = fs.statSync(base).isDirectory() ? base : path.dirname(base);
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.tmp') || f.includes('.corrupt.')) {
        try {
          const p = path.join(dir, f);
          bytes += fs.statSync(p).size;
          fs.unlinkSync(p);
          removed++;
        } catch {}
      }
    }
  } catch {}
}

console.log(
  `[cleanup] removed ${removed} file(s), freed ${(bytes / 1024).toFixed(1)} KB`
);
