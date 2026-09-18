const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/antisticker.json');

if (!fs.existsSync(path.dirname(dataFile))) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
}

function loadData() {
    try {
        if (fs.existsSync(dataFile)) return JSON.parse(fs.readFileSync(dataFile));
    } catch {}
    return {};
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function isAdmin(sock, chatId, userId) {
    try {
        const meta = await sock.groupMetadata(chatId);
        const admins = meta.participants.filter(p => p.admin);
        return admins.some(p => p.id === userId);
    } catch {
        return false;
    }
}

// Command: .antisticker on/off
async function antistickerCommand(sock, chatId, message, userMessage, senderId) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });
        }

        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (!senderIsAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' }, { quoted: message });
        }

        const arg = userMessage.trim().split(/\s+/)[1]?.toLowerCase();
        const data = loadData();
        if (!data[chatId]) data[chatId] = { enabled: false };

        if (arg === 'on') {
            data[chatId].enabled = true;
        } else if (arg === 'off') {
            data[chatId].enabled = false;
        } else {
            data[chatId].enabled = !data[chatId].enabled;
        }

        saveData(data);
        await sock.sendMessage(chatId, {
            text: `✅ Anti-Sticker ${data[chatId].enabled ? 'ENABLED 🚫 — stickers from non-admins will be deleted.' : 'DISABLED ✅'}`
        }, { quoted: message });
    } catch (e) {
        console.log('[antistickerCommand]', e.message);
    }
}

// Auto-detection: called on every group message
async function handleAntistickerDetection(sock, chatId, message, senderId) {
    try {
        if (!chatId.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const isSticker = !!message.message?.stickerMessage;
        if (!isSticker) return;

        const data = loadData();
        if (!data[chatId]?.enabled) return;

        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return;

        // Delete the sticker
        await sock.sendMessage(chatId, {
            delete: message.key
        });

        await sock.sendMessage(chatId, {
            text: `@${senderId.split('@')[0]} ❌ Stickers are not allowed in this group!`,
            mentions: [senderId]
        });
    } catch (e) {
        console.log('[handleAntistickerDetection]', e.message);
    }
}

module.exports = { antistickerCommand, handleAntistickerDetection };
