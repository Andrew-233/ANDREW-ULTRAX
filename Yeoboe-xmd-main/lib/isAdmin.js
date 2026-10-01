const { normalizeJid, findParticipant } = require('./jid');

const adminCache = new Map();
const CACHE_TTL = 60000;

function getCacheKey(chatId, senderId) {
    return `${chatId}:${senderId}`;
}

function clearGroupCache(chatId) {
    for (const key of adminCache.keys()) {
        if (key.startsWith(chatId + ':')) {
            adminCache.delete(key);
        }
    }
}

async function isAdmin(sock, chatId, senderId) {
    try {
        const cacheKey = getCacheKey(chatId, senderId);
        const cached = adminCache.get(cacheKey);
        if (cached && Date.now() - cached.time < CACHE_TTL) {
            return cached.result;
        }

        const groupMetadata = await sock.groupMetadata(chatId);

        const botId = normalizeJid(sock.user.id);
        const normalizedSender = normalizeJid(senderId);

        const participant = findParticipant(groupMetadata.participants, normalizedSender);
        const bot = findParticipant(groupMetadata.participants, botId);

        const senderRole = participant?.admin || null;
        const botRole = bot?.admin || null;

        const isSenderAdmin = senderRole === 'admin' || senderRole === 'superadmin';
        const isSuperAdmin = senderRole === 'superadmin';
        const isBotAdmin = botRole === 'admin' || botRole === 'superadmin';

        const result = { isSenderAdmin, isBotAdmin, isSuperAdmin };

        adminCache.set(cacheKey, { result, time: Date.now() });

        if (adminCache.size > 500) {
            const oldest = adminCache.keys().next().value;
            adminCache.delete(oldest);
        }

        return result;
    } catch (error) {
        console.error(`Error in isAdmin for chat ${chatId}, sender ${senderId}:`, error);
        return { isSenderAdmin: false, isBotAdmin: false, isSuperAdmin: false };
    }
}

module.exports = isAdmin;
module.exports.clearGroupCache = clearGroupCache;
