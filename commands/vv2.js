const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const { createFakeContact } = require('../lib/fakeContact');
async function vv2Command(sock, chatId, message) {
    try {
        const fkontak = createFakeContact(message);
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted) {
            return await sock.sendMessage(chatId, { text: 'Reply to a viewonce message.' }, { quoted: createFakeContact(message) });
        }

        const quotedImage = quoted?.imageMessage || quoted?.viewOnceMessageV2?.message?.imageMessage || quoted?.viewOnceMessage?.message?.imageMessage;
        const quotedVideo = quoted?.videoMessage || quoted?.viewOnceMessageV2?.message?.videoMessage || quoted?.viewOnceMessage?.message?.videoMessage;
        const quotedAudio = quoted?.audioMessage || quoted?.viewOnceMessageV2?.message?.audioMessage || quoted?.viewOnceMessage?.message?.audioMessage;

        const downloadBuffer = async (msg, type) => {
            const stream = await downloadContentFromMessage(msg, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            return buffer;
        };

        // Get owner Jid from sock.user.id
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (quotedImage && (quotedImage.viewOnce || quoted.viewOnceMessageV2 || quoted.viewOnceMessage)) {
            const buffer = await downloadBuffer(quotedImage, 'image');
            await sock.sendMessage(ownerJid, { 
                image: buffer, 
                caption: quotedImage.caption || 'Retrieved ViewOnce Image' 
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } else if (quotedVideo && (quotedVideo.viewOnce || quoted.viewOnceMessageV2 || quoted.viewOnceMessage)) {
            const buffer = await downloadBuffer(quotedVideo, 'video');
            await sock.sendMessage(ownerJid, { 
                video: buffer, 
                caption: quotedVideo.caption || 'Retrieved ViewOnce Video' 
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } else if (quotedAudio && (quotedAudio.viewOnce || quoted.viewOnceMessageV2 || quoted.viewOnceMessage)) {
            const buffer = await downloadBuffer(quotedAudio, 'audio');
            await sock.sendMessage(ownerJid, { 
                audio: buffer, 
                mimetype: quotedAudio.mimetype || 'audio/mp4'
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } else {
            await sock.sendMessage(chatId, { text: 'Reply to a valid view-once media.' }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('VV2 Error:', error);
        await sock.sendMessage(chatId, { text: 'Failed to process viewonce message.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = vv2Command;
