/**
 * June-X Bot
 * Autoboth Command - Shows typing and recording alternating
 */

const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');
const { createFakeContact } = require('../lib/fakeContact');

const configPath = path.join(__dirname, '..', 'data', 'autoboth.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

function isAutobothEnabled() {
    try { return initConfig().enabled; } catch { return false; }
}

async function autobothCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: createFakeContact(message) });
            return;
        }

        const args = message.message?.conversation?.trim().split(' ').slice(1) ||
            message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || [];

        const config = initConfig();

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') config.enabled = true;
            else if (action === 'off' || action === 'disable') config.enabled = false;
            else {
                await sock.sendMessage(chatId, { text: '❌ Invalid option! Use: .autoboth on/off' }, { quoted: createFakeContact(message) });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, {
            text: `✅ Auto-both (typing + recording) has been ${config.enabled ? 'enabled' : 'disabled'}!\n${config.enabled ? '⌨️🎙️ Will alternate between typing and recording on every message.' : ''}`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in autoboth command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: createFakeContact(message) });
    }
}

// Send typing first (for before-command use, awaited)
async function sendBothStart(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('composing', chatId);
    } catch (e) {
        console.error('❌ sendBothStart error:', e.message);
    }
}

// Alternate typing/recording in background (fire-and-forget, long version)
function sendBothBackground(sock, chatId, durationMs = 10000) {
    (async () => {
        try {
            let useTyping = false; // start with recording (already sent composing above)
            const switchMs = 3000;
            const cycles = Math.floor(durationMs / switchMs);

            for (let i = 0; i < cycles; i++) {
                await new Promise(r => setTimeout(r, switchMs));
                await sock.sendPresenceUpdate(useTyping ? 'composing' : 'recording', chatId);
                useTyping = !useTyping;
            }
            await sock.sendPresenceUpdate('paused', chatId);
        } catch (e) { /* ignore */ }
    })();
}

// Stop both
async function stopBoth(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (e) { /* ignore */ }
}

module.exports = {
    autobothCommand,
    isAutobothEnabled,
    sendBothStart,
    sendBothBackground,
    stopBoth
};
