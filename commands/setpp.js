const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');

async function setProfilePicture(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isSudo(senderId);
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Check if message is a reply
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ Please reply to an image with the .setpp command!' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Check if quoted message contains an image
        const imageMessage = quotedMessage.imageMessage || quotedMessage.stickerMessage;
        if (!imageMessage) {
            await sock.sendMessage(chatId, { 
                text: '❌ The replied message must contain an image!' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Create tmp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Download the image
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const imagePath = path.join(tmpDir, `profile_${Date.now()}.jpg`);
        
        // Save the image
        fs.writeFileSync(imagePath, buffer);

        // Set the profile picture
        await sock.updateProfilePicture(sock.user.id, { url: imagePath });

        // Clean up the temporary file
        fs.unlinkSync(imagePath);

        await sock.sendMessage(chatId, { 
            text: '✅ Successfully updated bot profile picture!' 
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in setpp command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to update profile picture!' 
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = setProfilePicture;
