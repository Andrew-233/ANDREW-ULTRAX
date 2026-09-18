const fs = require('fs');

const PMBLOCKER_PATH = './data/pmblocker.json';

const { createFakeContact } = require('../lib/fakeContact');

function readState() {
    try {
        if (!fs.existsSync(PMBLOCKER_PATH)) return { enabled: false };
        const raw = fs.readFileSync(PMBLOCKER_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return { enabled: !!data.enabled };
    } catch {
        return { enabled: false };
    }
}

function writeState(enabled) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(PMBLOCKER_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    } catch {}
}

async function pmblockerCommand(sock, chatId, message, args) {
    const sub = (args || '').trim().split(' ')[0].toLowerCase();
    const state = readState();

    if (!sub || !['on', 'off', 'status'].includes(sub)) {
        await sock.sendMessage(chatId, {
            text: '*🚫 PM BLOCKER*\n\n' +
                  'Silently blocks anyone who DMs the bot (no reply sent).\n\n' +
                  '🔸 `.pmblocker on` — Enable silent PM block\n' +
                  '🔸 `.pmblocker off` — Disable PM block\n' +
                  '🔸 `.pmblocker status` — Show current status'
        }, { quoted: createFakeContact(message) });
        return;
    }

    if (sub === 'status') {
        await sock.sendMessage(chatId, {
            text: `🚫 *PM Blocker:* ${state.enabled ? '✅ ON (silent block active)' : '❌ OFF'}`
        }, { quoted: createFakeContact(message) });
        return;
    }

    const enable = sub === 'on';
    writeState(enable);
    await sock.sendMessage(chatId, {
        text: `🚫 *PM Blocker* is now *${enable ? 'ENABLED' : 'DISABLED'}*.\n` +
              (enable ? 'Anyone who DMs the bot will be silently blocked.' : 'DMs are now allowed.')
    }, { quoted: createFakeContact(message) });
}

module.exports = { pmblockerCommand, readState };
