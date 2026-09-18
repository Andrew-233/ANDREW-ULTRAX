const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { isSudo } = require('../lib/index');

async function ensureGroupAndAdmin(sock, chatId, senderId, message) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return { ok: false };
    }
    const isOwner = (message && message.key.fromMe) || await isSudo(senderId);
    if (isOwner) return { ok: true };
    // Check admin status of sender and bot
    const isAdmin = require('../lib/isAdmin');
    const adminStatus = await isAdmin(sock, chatId, senderId);
    if (!adminStatus.isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' });
        return { ok: false };
    }
    if (!adminStatus.isSenderAdmin) {
        await sock.sendMessage(chatId, { text: 'Only group admins can use this command.' });
        return { ok: false };
    }
    return { ok: true };
}

async function setGroupDescription(sock, chatId, senderId, text, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;
    const desc = (text || '').trim();
    if (!desc) {
        await sock.sendMessage(chatId, { text: 'Usage: .setgdesc <description>' }, { quoted: message });
        return;
    }
    try {
        await sock.groupUpdateDescription(chatId, desc);
        await sock.sendMessage(chatId, { text: '✅ Group description updated.' }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to update group description.' }, { quoted: message });
    }
}

async function setGroupName(sock, chatId, senderId, text, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;
    const name = (text || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: 'Usage: .setgname <new name>' }, { quoted: message });
        return;
    }
    try {
        await sock.groupUpdateSubject(chatId, name);
        await sock.sendMessage(chatId, { text: '✅ Group name updated.' }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to update group name.' }, { quoted: message });
    }
}

async function setGroupPhoto(sock, chatId, senderId, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMessage = quoted?.imageMessage || quoted?.stickerMessage;
    if (!imageMessage) {
        await sock.sendMessage(chatId, { text: 'Reply to an image/sticker with .setgpp' }, { quoted: message });
        return;
    }
    try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const imgPath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);
        fs.writeFileSync(imgPath, buffer);

        await sock.updateProfilePicture(chatId, { url: imgPath });
        try { fs.unlinkSync(imgPath); } catch (_) {}
        await sock.sendMessage(chatId, { text: '✅ Group profile photo updated.' }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to update group profile photo.' }, { quoted: message });
    }
}

async function getGroupProfile(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return;
    }
    try {
        let pp;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
        } catch (e) {
            pp = null;
        }
        if (!pp) {
            await sock.sendMessage(chatId, { text: '❌ This group has no profile picture set.' }, { quoted: message });
            return;
        }
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: `📸 *Group Profile Picture*\n👥 *Group:* ${meta.subject || 'Unknown'}`
        }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group profile picture.' }, { quoted: message });
    }
}

async function getGroupName(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return;
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            text: `📝 *Group Name:* ${meta.subject || 'No name set'}`
        }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group name.' }, { quoted: message });
    }
}

async function getGroupDescription(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return;
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const desc = meta.desc ? meta.desc.toString().trim() : null;
        await sock.sendMessage(chatId, {
            text: desc
                ? `📋 *Group Description:*\n\n${desc}`
                : '❌ This group has no description.'
        }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group description.' }, { quoted: message });
    }
}

async function setDisappearingMessages(sock, chatId, senderId, args, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return;
    }
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;

    const option = (args || '').trim().toLowerCase();

    const durations = {
        'off': 0,
        '24h': 86400,
        '7d': 604800,
        '90d': 7776000
    };

    if (!durations.hasOwnProperty(option)) {
        await sock.sendMessage(chatId, {
            text: '❌ Usage: .setdispmessage <off | 24h | 7d | 90d>\n\n' +
                  '• *off* — Disable disappearing messages\n' +
                  '• *24h* — Messages disappear after 24 hours\n' +
                  '• *7d* — Messages disappear after 7 days\n' +
                  '• *90d* — Messages disappear after 90 days'
        }, { quoted: message });
        return;
    }

    try {
        await sock.groupToggleEphemeral(chatId, durations[option]);
        const label = option === 'off' ? 'disabled' : `set to ${option}`;
        await sock.sendMessage(chatId, {
            text: `✅ Disappearing messages ${label}.`
        }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to update disappearing messages.' }, { quoted: message });
    }
}

module.exports = {
    setGroupDescription,
    setGroupName,
    setGroupPhoto,
    getGroupProfile,
    getGroupName,
    getGroupDescription,
    setDisappearingMessages
};


