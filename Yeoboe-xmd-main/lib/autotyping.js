/**
 * June-X Bot
 * Autotyping Command - Shows fake typing status
 */

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { createFakeContact } = require('../lib/fakeContact');

const configPath = path.join(__dirname, '..', 'data', 'autotyping.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

function isAutotypingEnabled() {
    try { return initConfig().enabled; } catch { return false; }
}

async function autotypingCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
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
                await sock.sendMessage(chatId, { text: '❌ Invalid option! Use: .autotyping on/off' }, { quoted: createFakeContact(message) });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { text: `✅ Auto-typing has been ${config.enabled ? 'enabled' : 'disabled'}!` }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in autotyping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: createFakeContact(message) });
    }
}

// Send composing presence once (fast — just one WS frame)
async function sendTyping(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('composing', chatId);
    } catch (e) {
        console.error('❌ sendTyping error:', e.message);
    }
}

// Stop composing
async function stopTyping(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (e) { /* ignore */ }
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    sendTyping,
    stopTyping
};
