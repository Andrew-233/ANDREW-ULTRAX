const { isSudo } = require('../lib/index');
const { createFakeContact } = require('../lib/fakeContact');

const DURATIONS = {
    off:  0,
    '24h': 86400,
    '7d':  604800,
    '90d': 7776000,
};

const DURATION_LABELS = {
    0:       '❌ Off',
    86400:   '⏱ 24 hours',
    604800:  '📅 7 days',
    7776000: '🗓 90 days',
};

async function dispCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const isOwner = message.key.fromMe || await isSudo(message.key.participant || message.key.remoteJid);

        if (!isOwner) {
            return sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can use this command.'
            }, { quoted: createFakeContact(message) });
        }

        const isGroup = chatId.endsWith('@g.us');
        if (isGroup) {
            return sock.sendMessage(chatId, {
                text: '❌ This command is for *private chats* only.\nUse *.disappear* in groups instead.'
            }, { quoted: createFakeContact(message) });
        }

        const rawText = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || '';

        const args = rawText.trim().split(/\s+/);
        const option = (args[1] || '').toLowerCase();

        if (!option || !(option in DURATIONS)) {
            return sock.sendMessage(chatId, {
                text: `┏━━━━━✧ DISAPPEARING MSGS ✧━━━━━
┃✧ Sets disappearing messages in
┃✧ this private chat.
┃
┃✧ *Usage:*
┃  .disp off   — Disable
┃  .disp 24h   — 24 hours
┃  .disp 7d    — 7 days
┃  .disp 90d   — 90 days
┗━━━━━━━━━━━━━━━━━━━━━`
            }, { quoted: createFakeContact(message) });
        }

        const duration = DURATIONS[option];

        // For private chats Baileys uses sendMessage with disappearingMessagesInChat.
        // false = off (0 seconds), a number = specific duration in seconds.
        await sock.sendMessage(chatId, {
            disappearingMessagesInChat: duration === 0 ? false : duration
        });

        const label = DURATION_LABELS[duration] || option;
        await sock.sendMessage(chatId, {
            text: `✅ Disappearing messages *${label}* in this chat.`
        }, { quoted: createFakeContact(message) });

    } catch (err) {
        console.error('dispCommand error:', err.message || err);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to update disappearing messages.\nError: ${err.message || 'unknown'}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = dispCommand;
