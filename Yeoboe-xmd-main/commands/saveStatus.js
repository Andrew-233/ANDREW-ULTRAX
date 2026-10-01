const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function saveStatusCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            return sock.sendMessage(chatId, { text: '😡 Command only for the owner.' }, { quoted: createFakeContact(message) });
        }

        const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = quotedInfo?.quotedMessage;

        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' }, { quoted: createFakeContact(message) });
            return sock.sendMessage(chatId, { react: { text: '📑', key: message.key } });
        }

        console.log('🔍 Full quotedMsg:', JSON.stringify(quotedMsg, null, 2));

        // 📝 Handle text status
        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            console.log('📝 Detected text status:', text);
            await sock.sendMessage(chatId, { text: `📑 saved successfully!` }, { quoted: createFakeContact(message) });
            return sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        let mediaType, extension;
        if (quotedMsg.imageMessage) {
            mediaType = 'image';
            extension = 'jpg';
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
            extension = 'mp4';
        } else if (quotedMsg.audioMessage) {
            mediaType = 'audio';
            extension = 'ogg';
        } else {
            console.log('❌ Unsupported quotedMsg type:', Object.keys(quotedMsg));
            await sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.' }, { quoted: createFakeContact(message) });
            return sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        console.log(`📌 Detected mediaType: ${mediaType}, extension: ${extension}`);

        // ⏳ Reaction: downloading
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await sock.sendMessage(chatId, { text: '📥 _Downloading update ..._' }, { quoted: createFakeContact(message) });

        // 📥 Download media
        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        console.log(`✅ Downloaded buffer length: ${buffer.length}`);

        const dirPath = path.join(__dirname, '..', 'data', 'statuses');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log('📂 Created directory:', dirPath);
        }

        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);
        console.log('💾 Saved file at:', filepath);

        await sock.sendMessage(chatId, {
            [mediaType]: buffer
        }, { quoted: createFakeContact(message) });

        // 🎯 Final reaction: success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        await sock.sendMessage(chatId, { text: `🉐 Failed to save status. Error: ${error?.stack || error}` }, { quoted: createFakeContact(message) });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = saveStatusCommand;
