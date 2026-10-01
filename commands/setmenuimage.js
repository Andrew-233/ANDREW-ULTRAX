const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const MENU_IMAGE_PATH = path.join(__dirname, '..', 'data', 'menuimage.jpg');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

async function setMenuImageCommand(sock, chatId, senderId, message, userMessage) {
    if (!message.key.fromMe) {
        await sock.sendMessage(chatId, { text: '❌ Only bot owner can change the menu image!' });
        return;
    }

    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMessage) {
        await sock.sendMessage(chatId, { text: '⚠️ Please reply to an image with the setmenuimage command!' });
        return;
    }

    const imageMessage = quotedMessage.imageMessage;
    if (!imageMessage) {
        await sock.sendMessage(chatId, { text: '❌ The replied message must contain an image!' });
        return;
    }

    try {
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        fs.writeFileSync(MENU_IMAGE_PATH, buffer);

        await sock.sendMessage(chatId, { text: '✅ Menu image updated successfully!' });
    } catch (error) {
        console.error('Error in setmenuimage command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to update menu image!' });
    }
}

function getMenuImagePath() {
    return fs.existsSync(MENU_IMAGE_PATH) ? MENU_IMAGE_PATH : null;
}

module.exports = setMenuImageCommand;
module.exports.getMenuImagePath = getMenuImagePath;
