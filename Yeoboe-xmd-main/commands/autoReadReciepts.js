/**
 *  Junex Bot
 * Autoread Receipts Command - Manage read receipts privacy
 */

const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreadreceipts.json');

// Default configuration
const DEFAULT_CONFIG = {
    enabled: false,
    readReceipts: 'all' // Default: send read receipts to everyone
};

// ---------- Config Utilities ----------

// Load config safely
const { createFakeContact } = require('../lib/fakeContact');
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            saveConfig(DEFAULT_CONFIG);
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
        console.error('⚠️ Failed to load config, using defaults:', err);
        return { ...DEFAULT_CONFIG };
    }
}

// Save config safely
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('⚠️ Failed to save config:', err);
    }
}

// ---------- Command Handler ----------

async function autoreadReceiptsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            return sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: createFakeContact(message) });
        }

        // Extract arguments
        const rawText = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/).slice(1);

        const config = loadConfig();

        // Show current status if no args
        if (args.length === 0) {
            const status = config.readReceipts || 'all';
            const statusText = {
                all: 'Everyone',
                contacts: 'Contacts only',
                none: 'No one'
            }[status] || status;

            return sock.sendMessage(chatId, {
                text: `📱 Read Receipts Status: ${statusText}\n\n` +
                      'Usage: .autoreadreceipts <option>\n' +
                      'Options: all, contacts, none'
            }, { quoted: createFakeContact(message) });
        }

        // Validate option
        const option = args[0].toLowerCase();
        const validOptions = ['all', 'contacts', 'none'];

        if (!validOptions.includes(option)) {
            return sock.sendMessage(chatId, {
                text: '❌ Invalid option! Use: all, contacts, or none'
            }, { quoted: createFakeContact(message) });
        }

        // Update config + apply setting
        config.readReceipts = option;
        saveConfig(config);

        await sock.updateReadReceiptsPrivacy(option);

        return sock.sendMessage(chatId, {
            text: `✅ Read receipts set to: ${option}\n\n` +
                  `• all = Send read receipts to everyone\n` +
                  `• contacts = Send only to contacts\n` +
                  `• none = Don't send read receipts`
        }, { quoted: createFakeContact(message) });

    } catch (err) {
        console.error('❌ Error in autoreadReceiptsCommand:', err);
        return sock.sendMessage(chatId, { text: '❌ Failed to update read receipts!' }, { quoted: createFakeContact(message) });
    }
}

// ---------- Startup Helper ----------

async function applyReadReceiptsPrivacy(sock) {
    try {
        const config = loadConfig();
        const privacySetting = config.readReceipts || 'all';

        await sock.updateReadReceiptsPrivacy(privacySetting);
        console.log(`✅ Read receipts privacy applied: ${privacySetting}`);

        return privacySetting;
    } catch (err) {
        console.error('❌ Error applying read receipts privacy:', err);
        return 'all'; // Fallback
    }
}

// ---------- Getter ----------

function getReadReceiptsSetting() {
    try {
        const config = loadConfig();
        return config.readReceipts || 'all';
    } catch (err) {
        console.error('❌ Error getting read receipts setting:', err);
        return 'all';
    }
}

// ---------- Simple On/Off Read Receipts Command ----------

async function readReceiptsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            return sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: createFakeContact(message) });
        }

        const rawText = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text || '';
        const arg = rawText.trim().split(/\s+/)[1]?.toLowerCase();

        const config = loadConfig();

        if (!arg) {
            const current = config.readReceipts || 'all';
            const statusLabel = current === 'none' ? '❌ OFF (not sending receipts)' : '✅ ON (sending receipts)';
            return sock.sendMessage(chatId, {
                text: `📱 *Read Receipts Status:* ${statusLabel}\n\n` +
                      `Usage: .readreciepts on | off`
            }, { quoted: createFakeContact(message) });
        }

        if (arg === 'on') {
            config.readReceipts = 'all';
            saveConfig(config);
            await sock.updateReadReceiptsPrivacy('all');
            return sock.sendMessage(chatId, {
                text: '✅ Read receipts turned *ON*. Everyone will see when you read messages.'
            }, { quoted: createFakeContact(message) });
        }

        if (arg === 'off') {
            config.readReceipts = 'none';
            saveConfig(config);
            await sock.updateReadReceiptsPrivacy('none');
            return sock.sendMessage(chatId, {
                text: '✅ Read receipts turned *OFF*. No one will see when you read messages.'
            }, { quoted: createFakeContact(message) });
        }

        return sock.sendMessage(chatId, {
            text: '❌ Invalid option! Usage: .readreciepts on | off'
        }, { quoted: createFakeContact(message) });

    } catch (err) {
        console.error('❌ Error in readReceiptsCommand:', err);
        return sock.sendMessage(chatId, { text: '❌ Failed to update read receipts!' }, { quoted: createFakeContact(message) });
    }
}

// ---------- Exports ----------
module.exports = {
    autoreadReceiptsCommand,
    applyReadReceiptsPrivacy,
    getReadReceiptsSetting,
    readReceiptsCommand
};
