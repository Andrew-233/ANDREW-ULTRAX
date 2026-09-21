#!/usr/bin/env node
/**
 * reset-session.js - clears the saved WhatsApp session so the next start shows a fresh QR.
 *
 * This file was referenced by `npm run reset-session` (and therefore `npm run start:fresh`)
 * but never existed. Deleting the session logs the bot out of WhatsApp, so this requires an
 * explicit --yes flag rather than running on a bare invocation.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SESSION_DIRS = [
  path.join(__dirname, 'session'),
  path.join(__dirname, 'Creds.json'),
  path.join(__dirname, 'baileys-store'),
];

const confirmed = process.argv.includes('--yes') || process.argv.includes('-y');

function rmrf(p) {
  try {
    if (!fs.existsSync(p)) return 0;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      let n = 0;
      for (const e of fs.readdirSync(p)) n += rmrf(path.join(p, e));
      fs.rmdirSync(p);
      return n + 1;
    }
    fs.unlinkSync(p);
    return 1;
  } catch (err) {
    console.error(`[reset-session] failed to remove ${p}: ${err.message}`);
    return 0;
  }
}

const existing = SESSION_DIRS.filter(p => fs.existsSync(p));

if (!existing.length) {
  console.log('[reset-session] no session found - nothing to do.');
  process.exit(0);
}

async function main() {
  if (!confirmed) {
    console.log('This will log the bot OUT of WhatsApp and require a new QR/SESSION_ID scan.');
    console.log('Files to remove:');
    existing.forEach(p => console.log('  - ' + path.relative(__dirname, p)));
    if (!process.stdin.isTTY) {
      console.error('\nNon-interactive shell: refusing to delete a session without --yes.');
      process.exit(2);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(res => rl.question('\nType "reset" to continue: ', res));
    rl.close();
    if (answer.trim() !== 'reset') {
      console.log('[reset-session] aborted, session kept.');
      process.exit(0);
    }
  }
  let n = 0;
  for (const p of existing) n += rmrf(p);
  console.log(`[reset-session] removed ${n} item(s). Next start will ask for a new QR/SESSION_ID.`);
}

main().catch(err => {
  console.error('[reset-session] error:', err.message);
  process.exit(1);
});
