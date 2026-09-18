
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
// Settings file path: one level up from this script, inside a 'data' folder
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'antiedit_settings.json');

// Ensure the data directory exists
const settingsDir = path.dirname(SETTINGS_FILE);
if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
}

// In‑memory store for quick access
const antieditSettings = new Map();

// ==================== PERSISTENCE ====================
const { createFakeContact } = require('../lib/fakeContact');
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            for (const [chatId, enabled] of Object.entries(data)) {
                antieditSettings.set(chatId, enabled);
            }
            console.log('[AntiEdit] Settings loaded from', SETTINGS_FILE);
        }
    } catch (err) {
        console.error('[AntiEdit] Failed to load settings:', err);
    }
}

function saveSettings() {
    try {
        const obj = Object.fromEntries(antieditSettings);
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2));
        console.log('[AntiEdit] Settings saved.');
    } catch (err) {
        console.error('[AntiEdit] Failed to save settings:', err);
    }
}

// Initialize settings on module load
loadSettings();

// ==================== COMMAND HANDLER ====================
/**
 * Command handler for .antiedit
 * Usage: .antiedit on|off  (or no argument to check status)
 */
async function antieditCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🛡️', key: message.key }
        });

        // Extract arguments
        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     message.message?.imageMessage?.caption ||
                     '';
        const parts = text.split(' ');
        const args = parts.slice(1).join(' ').trim().toLowerCase();

        let replyText = '';

        if (args === 'on') {
            antieditSettings.set(chatId, true);
            saveSettings();
            replyText = '✅ Anti‑edit protection **enabled** for this chat. I will now notify when someone edits a message.';
        } else if (args === 'off') {
            antieditSettings.set(chatId, false);
            saveSettings();
            replyText = '❌ Anti‑edit protection **disabled** for this chat.';
        } else if (args === '') {
            const status = antieditSettings.get(chatId) ? 'enabled' : 'disabled';
            replyText = `🛡️ Anti‑edit protection is currently **${status}** for this chat.\n\nUse \`.antiedit on\` to enable or \`.antiedit off\` to disable.`;
        } else {
            // Invalid argument
            await sock.sendMessage(chatId, {
                text: '❌ Invalid argument. Use `on`, `off`, or no argument to check status.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Send response
        await sock.sendMessage(chatId, {
            text: replyText
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('[AntiEdit] Command error:', error);
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
        await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) });
    }
}

// ==================== EDIT DETECTION LISTENER ====================
/**
 * Sets up the event listener for edited messages.
 * Call this once after your WhatsApp socket is ready.
 * @param {any} sock - The WhatsApp socket instance from Baileys
 * @param {any} store - (Optional) The message store if you want original text comparison
 */
function setupAntiEditListener(sock, store) {
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            // Check if this update contains a message edit
            if (!update.update?.message) continue;

            const key = update.key;
            const chatId = key.remoteJid;

            // Skip if anti‑edit is not enabled for this chat
            if (!antieditSettings.get(chatId)) continue;

            // Try to get the original message (requires a message store)
            let originalMsg = null;
            if (store && typeof store.loadMessage === 'function') {
                originalMsg = await store.loadMessage(key.id);
            } else {
                // Fallback: just notify that a message was edited without showing original
                await sock.sendMessage(chatId, {
                    text: `✏️ A message was edited in this chat (original text not available).`
                }, { quoted: createFakeContact(message) });
                continue;
            }

            if (!originalMsg) {
                // Could not retrieve original – notify generic
                await sock.sendMessage(chatId, {
                    text: `✏️ A message was edited (could not fetch original).`
                }, { quoted: createFakeContact(message) });
                continue;
            }

            // Extract original and new text
            const originalText = originalMsg.message?.conversation ||
                                 originalMsg.message?.extendedTextMessage?.text ||
                                 '';
            const newText = update.update.message?.conversation ||
                            update.update.message?.extendedTextMessage?.text ||
                            '';

            // If text actually changed and we have both, send detailed notice
            if (originalText && newText && originalText !== newText) {
                const sender = originalMsg.pushName || key.participant || 'Someone';
                const notice = `✏️ *Message edited by ${sender}*\n\n*Original:*\n${originalText}\n\n*Edited to:*\n${newText}`;
                await sock.sendMessage(chatId, { text: notice }, { quoted: createFakeContact(message) });
            } else if (originalText || newText) {
                // At least one version exists, but maybe the other is missing
                await sock.sendMessage(chatId, {
                    text: `✏️ A message was edited (changes detected).`
                }, { quoted: createFakeContact(message) });
            }
        }
    });

    console.log('[AntiEdit] Listener attached.');
}

// ==================== EXPORTS ====================
module.exports = {
    antieditCommand,
    antieditSettings,   // exported in case you need to read settings elsewhere
    setupAntiEditListener
};
