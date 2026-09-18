/**
 * June-X Bot
 * Autorecording Command - Shows fake recording (voice note) status
 */

const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');
const { createFakeContact } = require('../lib/fakeContact');

const configPath = path.join(__dirname, '..', 'data', 'autorecording.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

function isAutorecordingEnabled() {
    try { return initConfig().enabled; } catch { return false; }
}

async function autorecordingCommand(sock, chatId, message) {
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
                await sock.sendMessage(chatId, { text: '❌ Invalid option! Use: .autorecording on/off' }, { quoted: createFakeContact(message) });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { text: `✅ Auto-recording has been ${config.enabled ? 'enabled' : 'disabled'}!` }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in autorecording command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: createFakeContact(message) });
    }
}

// Send recording presence once (fast — just one WS frame)
async function sendRecording(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('recording', chatId);
    } catch (e) {
        console.error('❌ sendRecording error:', e.message);
    }
}

// Stop recording
async function stopRecording(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (e) { /* ignore */ }
}

module.exports = {
    autorecordingCommand,
    isAutorecordingEnabled,
    sendRecording,
    stopRecording
};
