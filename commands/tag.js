const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const { createFakeContact } = require('../lib/fakeContact');
async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    // ✅ Restrict to groups only
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: createFakeContact(message) });
        return;
    }

    const isOwner = (message && message.key.fromMe) || await isSudo(senderId);
    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: createFakeContact(message) });
            return;
        }

        if (!isSenderAdmin) {
            const stickerPath = './assets/sticktag.webp';
            if (fs.existsSync(stickerPath)) {
                const stickerBuffer = fs.readFileSync(stickerPath);
                await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: createFakeContact(message) });
            }
            return;
        }
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;
    const mentionedJidList = participants.map(p => p.id);

    if (replyMessage) {
        let messageContent = {};

        if (replyMessage.imageMessage) {
            const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
            messageContent = {
                image: { url: filePath },
                caption: messageText || replyMessage.imageMessage.caption || '',
                mentions: mentionedJidList
            };
        } else if (replyMessage.videoMessage) {
            const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
            messageContent = {
                video: { url: filePath },
                caption: messageText || replyMessage.videoMessage.caption || '',
                mentions: mentionedJidList
            };
        } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
            messageContent = {
                text: replyMessage.conversation || replyMessage.extendedTextMessage.text,
                mentions: mentionedJidList
            };
        } else if (replyMessage.documentMessage) {
            const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
            messageContent = {
                document: { url: filePath },
                fileName: replyMessage.documentMessage.fileName,
                caption: messageText || '',
                mentions: mentionedJidList
            };
        }

        if (Object.keys(messageContent).length > 0) {
            await sock.sendMessage(chatId, messageContent);
        }
    } else {
        await sock.sendMessage(chatId, {
            text: messageText || "Tagged message",
            mentions: mentionedJidList
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = tagCommand;
