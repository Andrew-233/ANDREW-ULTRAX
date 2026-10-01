const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

const { createFakeContact } = require('../lib/fakeContact');
async function ttsCommand(sock, chatId, text, message, language = 'en') {
    // If no text provided, try to get it from quoted or mentioned message
    if (!text) {
        if (message?.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            // Extract text from quoted message
            const quotedMsg = message.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quotedMsg.conversation) {
                text = quotedMsg.conversation;
            } else if (quotedMsg.extendedTextMessage?.text) {
                text = quotedMsg.extendedTextMessage.text;
            }
        } else if (message?.message?.extendedTextMessage?.text) {
            // Extract text from mentioned message
            text = message.message.extendedTextMessage.text;
        }
    }

    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide the text for TTS conversion or reply/mention a message.' }, { quoted: createFakeContact(message) });
        return;
    }

    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(__dirname, '..', 'assets', fileName);

    const gtts = new gTTS(text, language);
    gtts.save(filePath, async function (err) {
        if (err) {
            await sock.sendMessage(chatId, { text: 'Error generating TTS audio.' }, { quoted: createFakeContact(message) });
            return;
        }

        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg'
        }, { quoted: createFakeContact(message) });

        fs.unlinkSync(filePath);
    });
}

module.exports = ttsCommand;
