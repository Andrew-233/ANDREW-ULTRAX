const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const { compareJids, toUserJid, extractNumber } = require('../lib/jid');

const { createFakeContact } = require('../lib/fakeContact');
function extractMentionedJid(message) {
    try {
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) return mentioned[0];

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const match = text.match(/\b(\d{7,15})\b/);
        if (match) return `${match[1]}@s.whatsapp.net`;

        return null;
    } catch (err) {
        console.error('extractMentionedJid error:', err);
        return null;
    }
}

async function sudoCommand(sock, chatId, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const ownerJid = toUserJid(settings.ownerNumber);
        const isOwner = message.key.fromMe || compareJids(senderJid, ownerJid);

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/).slice(1);
        const sub = (args[0] || '').toLowerCase();

        // ✅ Defensive usage check
        if (!sub || !['add', 'del', 'remove', 'list'].includes(sub)) {
            await sock.sendMessage(chatId, {
                text: [
                    '⚙️ *Sudo Command Usage*',
                    '🔹 .sudo add <@user|number>',
                    '🔹 .sudo del <@user|number>',
                    '🔹 .sudo list'
                ].join('\n')
            }, { quoted: createFakeContact(message) });
            return;
        }

        if (sub === 'list') {
            const list = await getSudoList();
            if (!list || list.length === 0) {
                await sock.sendMessage(chatId, { text: '📭 No sudo users set.' }, { quoted: createFakeContact(message) });
                return;
            }
            const text = list.map((j, i) => `${i + 1}. @${extractNumber(j)}`).join('\n');
            const mentions = list.map(j => j);
            await sock.sendMessage(chatId, { text: `👑 *Sudo Users:*\n${text}`, mentions }, { quoted: createFakeContact(message) });
            return;
        }

        // ✅ Owner-only restriction
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the *owner* can add/remove sudo users.\nUse `.sudo list` to view current sudo users.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // ✅ Extract target JID
        const targetJid = extractMentionedJid(message);
        if (!targetJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Please *mention a user* or provide a valid number.' }, { quoted: createFakeContact(message) });
            return;
        }

        if (sub === 'add') {
            const ok = await addSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? `✅ Added sudo: @${extractNumber(targetJid)}` : '❌ Failed to add sudo.',
                mentions: ok ? [targetJid] : []
            }, { quoted: createFakeContact(message) });
            return;
        }

        if (sub === 'del' || sub === 'remove') {
            if (compareJids(targetJid, ownerJid)) {
                await sock.sendMessage(chatId, { text: '⚠️ Owner cannot be removed from sudo list.' }, { quoted: createFakeContact(message) });
                return;
            }
            const ok = await removeSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? `✅ Removed sudo: @${extractNumber(targetJid)}` : '❌ Failed to remove sudo.',
                mentions: ok ? [targetJid] : []
            }, { quoted: createFakeContact(message) });
            return;
        }
    } catch (err) {
        console.error('sudoCommand error:', err);
        await sock.sendMessage(chatId, { text: '⚠️ An unexpected error occurred while processing sudo command.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = sudoCommand;
