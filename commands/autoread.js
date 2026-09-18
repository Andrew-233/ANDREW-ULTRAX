/**
 * A WhatsApp Bot
 * Autoread Command - Automatically read messages
 * Modes: all | chats | groups | off
 */

const fs = require('fs');
const path = require('path');
const { getBotName } = require('../lib/botConfig');
const { isSudo } = require('../lib/index');

const configPath = path.join(__dirname, '..', 'data', 'autoread.json');

// Initialize configuration file if it doesn't exist
const { createFakeContact } = require('../lib/fakeContact');
function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ mode: 'off' }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

// Toggle autoread feature
async function autoreadCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!',
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: 'June_X_Official',
                        serverMessageId: -1
                    }
                }
            },{ quoted: createFakeContact(message) });
            return;
        }

        // Get command arguments
        const args = message.message?.conversation?.trim().split(' ').slice(1) || 
                    message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || 
                    [];

        // Initialize or read config
        const config = initConfig();

        // Handle different command options
        if (args.length === 0) {
            // Show usage when no arguments provided
        const usageText = `*📖 AUTO-READ STATUS 📖*

• 👨‍🔧 Current Mode: ${config.mode}

• *COMMANDS:*
• autoread - usage guide
• autoread status - Check current status
• autoread all - Enable for all chats and groups
• autoread chat - Enable for chats only
• autoread group - Enable for groups only
• autoread off - Disable auto-read
`;

            await sock.sendMessage(chatId, {
                text: usageText,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: '',
                        serverMessageId: -1
                    }
                }
            },{ quoted: createFakeContact(message) });
            return;
        }

        const action = args[0].toLowerCase();

        // Handle specific commands
        switch (action) {
            case 'all':
            case 'both':
                config.mode = 'all';
                break;

            case 'chat':
            case 'chats':
                config.mode = 'chats';
                break;

            case 'group':
            case 'groups':
                config.mode = 'groups';
                break;

            case 'off':
                config.mode = 'off';
                break;

            case 'status':
                // Show current status
                await sock.sendMessage(chatId, {
                    text: `📊 *AutoRead Status*\n\nCurrent Mode: *${config.mode}*`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '',
                            newsletterName: '',
                            serverMessageId: -1
                        }
                    }
                },{ quoted: createFakeContact(message) });
                return;

            default:
                await sock.sendMessage(chatId, {
                    text: '❌ Invalid option! Use: .autoread to see all available options',
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '',
                            newsletterName: '',
                            serverMessageId: -1
                        }
                    }
                },{ quoted: createFakeContact(message) });
                return;
        }

        // Save updated configuration
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Send confirmation message
        await sock.sendMessage(chatId, {
            text: `✅ Auto-read mode set to: *${config.mode}*`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        },{ quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in autoread command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        },{ quoted: createFakeContact(message) });
    }
}

// Function to get current autoread mode
function getAutoreadMode() {
    try {
        const config = initConfig();
        return config.mode;
    } catch (error) {
        console.error('Error checking autoread mode:', error);
        return 'off';
    }
}

// Function to check if bot is mentioned in a message
function isBotMentionedInMessage(message, botNumber) {
    if (!message.message) return false;

    const messageTypes = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
        'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'
    ];

    for (const type of messageTypes) {
        if (message.message[type]?.contextInfo?.mentionedJid) {
            const mentionedJid = message.message[type].contextInfo.mentionedJid;
            if (mentionedJid.some(jid => jid === botNumber)) {
                return true;
            }
        }
    }

    const textContent = 
        message.message.conversation || 
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption || '';

    if (textContent) {
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) {
            return true;
        }

        const botNames = [global.botname?.toLowerCase(), getBotName().toLowerCase(), 'bot', 'June', 'June-X Bot'];
        const words = textContent.toLowerCase().split(/\s+/);
        if (botNames.some(name => words.includes(name))) {
            return true;
        }
    }

    return false;
}

// Function to handle autoread functionality
async function handleAutoread(sock, message) {
    const mode = getAutoreadMode();
    if (mode === 'off') return false;

    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isBotMentioned = isBotMentionedInMessage(message, botNumber);

    // Skip marking as read if bot is mentioned
    if (isBotMentioned) return false;

    const isGroup = message.key.remoteJid.endsWith('@g.us');

    if (mode === 'all' || 
        (mode === 'chats' && !isGroup) || 
        (mode === 'groups' && isGroup)) {
        const key = { remoteJid: message.key.remoteJid, id: message.key.id, participant: message.key.participant };
        await sock.readMessages([key]);
        return true;
    }

    return false;
}

module.exports = {
    autoreadCommand,
    getAutoreadMode,
    isBotMentionedInMessage,
    handleAutoread
};
