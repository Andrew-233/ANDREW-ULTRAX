
const fs = require('fs');
const path = require('path');
const { createFakeContact } = require('./fakeContact');

// Path for storing auto-reaction state and custom reactions
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Default emojis for command reactions
const defaultEmojis = [
    '💞', '💘', '🥰', '💙', '💓', '💕',
    '❤️', '🧡', '💛', '💚', '💜', '🖤', '🤍', '❤️‍🔥',
    '😍', '🤩', '😘', '🥳', '😎', '🤭', '🫶', '👏',
    '🔥', '✨', '💫', '⭐', '🌟', '🎉', '🎊', '🙌',
    '😂', '🤣', '😭', '🫠', '💀', '👀', '🤯', '😱',
    '👍', '🫡', '💯', '🏆', '🚀', '🌹', '🦋', '🌸'
];

// Load auto-reaction state and custom reactions from file
function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
            return {
                enabled: data.autoReaction?.enabled || false,
                customReactions: Array.isArray(data.autoReaction?.customReactions)
                    ? data.autoReaction.customReactions
                    : defaultEmojis
            };
        }
    } catch (error) {
        console.error('Error loading auto-reaction state:', error);
    }
    return { enabled: false, customReactions: defaultEmojis };
}

// Save auto-reaction state and custom reactions to file
function saveAutoReactionState(state, customReactions = null) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA)
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA))
            : { groups: [], chatbot: {} };

        const reactionsToSave = Array.isArray(customReactions)
            ? customReactions
            : (Array.isArray(data.autoReaction?.customReactions)
                ? data.autoReaction.customReactions
                : defaultEmojis);

        data.autoReaction = { enabled: state, customReactions: reactionsToSave };
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving auto-reaction state:', error);
    }
}

// In-memory config
let autoReactionConfig = loadAutoReactionState();

function getRandomEmoji() {
    const reactions = autoReactionConfig.customReactions;
    if (!Array.isArray(reactions) || reactions.length === 0) {
        return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
    }
    return reactions[Math.floor(Math.random() * reactions.length)];
}

// React to any message (commands or regular messages from anyone)
async function addMessageReaction(sock, message) {
    try {
        if (!autoReactionConfig.enabled || !message?.key?.id) return;
        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Error adding message reaction:', error);
    }
}

// Kept as alias for backward compatibility
const addCommandReaction = addMessageReaction;

// Handle .areact command
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = messageText.trim().split(/\s+/);
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            autoReactionConfig.enabled = true;
            saveAutoReactionState(true, autoReactionConfig.customReactions);
            await sock.sendMessage(chatId, {
                text: '✅ Auto-reactions enabled.\n\nThe bot will now react to every message in all chats!'
            }, { quoted: createFakeContact(message) });

        } else if (action === 'off') {
            autoReactionConfig.enabled = false;
            saveAutoReactionState(false, autoReactionConfig.customReactions);
            await sock.sendMessage(chatId, {
                text: '✅ Auto-reactions disabled globally.'
            }, { quoted: createFakeContact(message) });

        } else if (action === 'set') {
            const customReactions = args.slice(2);

            if (customReactions.length === 0) {
                await sock.sendMessage(chatId, {
                    text: '❌ Please provide at least one emoji!\n\nExample: `.areact set 🎉 🚀 ⭐`'
                }, { quoted: createFakeContact(message) });
                return;
            }

            const validEmojis = customReactions.filter(e =>
                e.length <= 8 && /\p{Emoji}/u.test(e)
            );

            if (validEmojis.length === 0) {
                await sock.sendMessage(chatId, {
                    text: '❌ No valid emojis found! Please provide real emoji characters.'
                }, { quoted: createFakeContact(message) });
                return;
            }

            autoReactionConfig.customReactions = validEmojis;
            saveAutoReactionState(autoReactionConfig.enabled, validEmojis);
            await sock.sendMessage(chatId, {
                text: `✅ Custom reactions updated!\n\nNew reactions: ${validEmojis.join(' ')}\nAuto-reactions are currently ${autoReactionConfig.enabled ? 'enabled ✅' : 'disabled ❌'}`
            }, { quoted: createFakeContact(message) });

        } else if (action === 'reset') {
            autoReactionConfig.customReactions = defaultEmojis;
            saveAutoReactionState(autoReactionConfig.enabled, defaultEmojis);
            await sock.sendMessage(chatId, {
                text: `✅ Reactions reset to default!\n\nDefault: ${defaultEmojis.join(' ')}`
            }, { quoted: createFakeContact(message) });

        } else if (action === 'list') {
            const current = autoReactionConfig.customReactions.join(' ');
            await sock.sendMessage(chatId, {
                text: `📋 Current reactions: ${current}\n\nAuto-reactions: ${autoReactionConfig.enabled ? '✅ ON' : '❌ OFF'}`
            }, { quoted: createFakeContact(message) });

        } else {
            const state = autoReactionConfig.enabled ? '✅ enabled' : '❌ disabled';
            const current = autoReactionConfig.customReactions.join(' ');
            await sock.sendMessage(chatId, {
                text: `⚙️ *Auto-Reactions* — currently *${state}*\n\n` +
                      `📋 Current reactions: ${current}\n\n` +
                      `Reacts to every message from everyone in all chats.\n\n` +
                      `*Commands:*\n` +
                      `• \`.areact on\` — Enable\n` +
                      `• \`.areact off\` — Disable\n` +
                      `• \`.areact set 🎉 🚀 ⭐\` — Set custom reactions\n` +
                      `• \`.areact reset\` — Reset to default\n` +
                      `• \`.areact list\` — Show current reactions`
            }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error controlling auto-reactions'
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = {
    addCommandReaction,
    addMessageReaction,
    handleAreactCommand,
    getAutoReactionConfig: () => autoReactionConfig,
    defaultEmojis
};
