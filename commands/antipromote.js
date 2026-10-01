const {
    setAntipromote,
    getAntipromote,
    removeAntipromote,
    incrementBlockedCount,
    ensureDataDir
} = require('../lib/antipromote-file');
const isAdmin = require('../lib/isAdmin');
const { normalizeJid, compareJids } = require('../lib/jid');
const { createFakeContact } = require('../lib/fakeContact');

const promoteCooldowns = new Map();

async function antipromoteCommand(sock, chatId, message, senderId) {
    try {
        await ensureDataDir();

        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '❌ This command can only be used in groups.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ For Group Admins Only.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();
        const config = await getAntipromote(chatId);

        if (!action) {
            const usage =
                `🛡️ *ANTIPROMOTE COMMANDS*\n\n` +
                `• .antipromote on - Enable protection\n` +
                `• .antipromote off - Disable protection\n` +
                `• .antipromote status - Check current status\n\n` +
                `ℹ️ When enabled, any unauthorized promotion attempt will be instantly reversed.`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: createFakeContact(message) });
            return;
        }

        switch (action) {
            case 'on':
            case 'enable':
                await setAntipromote(chatId, 'on', senderId);
                await sock.sendMessage(chatId, {
                    text: `🛡️ *Antipromote Activated*\n\n✅ Unauthorized promotions are now blocked!\n⚠️ Any member promoted without permission will be instantly demoted back.`
                }, { quoted: createFakeContact(message) });
                break;

            case 'off':
            case 'disable':
                await removeAntipromote(chatId);
                await sock.sendMessage(chatId, {
                    text: `❌ *Antipromote Deactivated*\n\n⚠️ Members can now be promoted normally.`
                }, { quoted: createFakeContact(message) });
                break;

            case 'status':
            case 'get': {
                const statusText =
                    `🛡️ *ANTIPROMOTE STATUS*\n\n` +
                    `📌 Group: ${chatId.split('@')[0]}\n` +
                    `🔰 Status: ${config.enabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                    `🚫 Blocked Promotions: ${config.blockedCount || 0}\n` +
                    `📅 Last Updated: ${config.updatedAt ? new Date(config.updatedAt).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }) : 'Never'}\n\n` +
                    `${config.enabled ? '🟢 Unauthorized promotions are blocked' : '🔴 No protection active'}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: createFakeContact(message) });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid option.*\n\nUse `.antipromote` to see all available commands.'
                }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in antipromote command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred. Please try again later.'
        }, { quoted: createFakeContact(message) });
    }
}

async function handleAntipromote(sock, chatId, participants, author) {
    try {
        const config = await getAntipromote(chatId);
        if (!config.enabled) return false;

        const botJid = normalizeJid(sock.user?.id || '');
        const authorJid = normalizeJid(author);

        if (!authorJid) return false;
        if (compareJids(authorJid, botJid)) return false;

        const cooldownKey = `${chatId}:${authorJid}`;
        const now = Date.now();
        const lastAlert = promoteCooldowns.get(cooldownKey) || 0;
        if (now - lastAlert < 3000) {
            console.log(`[ANTIPROMOTE] Cooldown active for ${cooldownKey}, skipping duplicate`);
            return false;
        }
        promoteCooldowns.set(cooldownKey, now);

        const jids = participants
            .map(p => normalizeJid(typeof p === 'string' ? p : (p.id || '')))
            .filter(Boolean);

        if (jids.length === 0) return false;

        const adminStatus = await isAdmin(sock, chatId, authorJid);
        const isBotAdmin = adminStatus.isBotAdmin;

        const authorPhone = authorJid.split('@')[0];
        const mentionLines = jids.map(j => `  • @${j.split('@')[0]}`).join('\n');
        const plural = jids.length > 1 ? 's' : '';

        if (isBotAdmin) {
            try {
                await sock.groupParticipantsUpdate(chatId, jids, 'demote');
            } catch (err) {
                console.error(`[ANTIPROMOTE] Batch demote failed:`, err.message);
            }
            for (const jid of jids) {
                await incrementBlockedCount(chatId);
            }
            await sock.sendMessage(chatId, {
                text: `🛡️ *ANTIPROMOTE ACTIVE*\n\n` +
                      `⚠️ @${authorPhone} tried to promote ${jids.length} member${plural}!\n\n` +
                      `❌ Demoted back:\n${mentionLines}\n\n` +
                      `📌 Unauthorized promotions are not allowed in this group!`,
                mentions: [authorJid, ...jids]
            });
            console.log(`[ANTIPROMOTE] Demoted ${jids.length} participant(s) in ${chatId}`);
        } else {
            console.log(`[ANTIPROMOTE] Bot is not admin in ${chatId}, sending alert only`);
            await sock.sendMessage(chatId, {
                text: `🛡️ *ANTIPROMOTE ALERT*\n\n` +
                      `⚠️ @${authorPhone} tried to promote ${jids.length} member${plural}!\n\n` +
                      `👇 Affected:\n${mentionLines}\n\n` +
                      `❗ Give me admin role to auto-reverse promotions!`,
                mentions: [authorJid, ...jids]
            });
        }

        return true;
    } catch (error) {
        console.error('Error in handleAntipromote:', error);
        return false;
    }
}

module.exports = { antipromoteCommand, handleAntipromote };
