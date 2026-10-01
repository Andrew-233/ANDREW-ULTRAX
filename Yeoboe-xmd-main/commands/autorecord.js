/**
 * A WhatsApp Bot
 * Autorecording Command - Shows fake recording status (straight recording presence with fixed 15s duration)
 */

const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');

const configPath = path.join(__dirname, '..', 'data', 'autorecording.json');

// Initialize configuration file if it doesn't exist
const { createFakeContact } = require('../lib/fakeContact');
function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

// Toggle autorecording feature
async function autorecordingCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const args = message.message?.conversation?.trim().split(' ').slice(1) || 
                     message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || 
                     [];

        const config = initConfig();

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Invalid option! Use: .autorecording on/off'
                }, { quoted: createFakeContact(message) });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        await sock.sendMessage(chatId, {
            text: `✅ Auto-recording has been ${config.enabled ? 'enabled' : 'disabled'}!`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in autorecording command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!'
        }, { quoted: createFakeContact(message) });
    }
}

// Function to check if autorecording is enabled
function isAutorecordingEnabled() {
    try {
        const config = initConfig();
        return config.enabled;
    } catch (error) {
        console.error('Error checking autorecording status:', error);
        return false;
    }
}

// Straight recording presence with fixed 15s duration
async function straightRecordingPresence(sock, chatId) {
    if (isAutorecordingEnabled()) {
        try {
            await sock.presenceSubscribe(chatId);

            // Show recording status
            await sock.sendPresenceUpdate('recording', chatId);

            const recordingDuration = 15000;
            await new Promise(resolve => setTimeout(resolve, recordingDuration));

            // End recording (paused state)
            await sock.sendPresenceUpdate('paused', chatId);

            return true;
        } catch (error) {
            console.error('❌ Error sending straight recording indicator:', error);
            return false;
        }
    }
    return false; // Autorecording disabled
}

// Handle autorecording for regular messages
async function handleAutorecordingForMessage(sock, chatId) {
    return await straightRecordingPresence(sock, chatId);
}

// Handle autorecording for commands (before execution)
async function handleAutorecordingForCommand(sock, chatId) {
    return await straightRecordingPresence(sock, chatId);
}

// Show recording status after command execution
async function showRecordingAfterCommand(sock, chatId) {
    return await straightRecordingPresence(sock, chatId);
}

module.exports = {
    autorecordingCommand,
    isAutorecordingEnabled,
    straightRecordingPresence,
    handleAutorecordingForMessage,
    handleAutorecordingForCommand,
    showRecordingAfterCommand
};
