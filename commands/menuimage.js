const { getBotName, getMenuImage, setMenuImage, getConfig, updateConfig } = require('../lib/botConfig');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function setbotconfigCommand(sock, chatId, message) {
    try {
        const botName = getBotName();
        const senderId = message.key.participant || message.key.remoteJid;

        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nThis command is only available for the owner!` }, { quoted: createFakeContact(message) });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        if (!action) {
            const config = getConfig();
            const usage = `*${botName} BOT CONFIGURATION*\n\n` +
                `Current Settings:\n` +
                `Bot Name: ${config.botName}\n` +
                `Menu Image: ${config.menuImage ? 'Set' : 'Not set (default)'}\n\n` +
                `Commands:\n` +
                `.menuimage - Reply to image to set menu image\n` +
                `.menuimage <url> - Set menu image from URL\n` +
                `.menuimage reset - Reset to default image\n` +
                `.configimage get - View current config`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: createFakeContact(message) });
            return;
        }

        if (action === 'get') {
            const config = getConfig();
            const statusText = `*${botName} Configuration*\n\n` +
                `Bot Name: ${config.botName}\n` +
                `Owner Name: ${config.ownerName}\n` +
                `Menu Image: ${config.menuImage ? 'Set' : 'Not set'}\n` +
                `Antidelete Private: ${config.antideletePrivate ? 'ON' : 'OFF'}`;
            await sock.sendMessage(chatId, { text: statusText }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in setbotconfig command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function setmenuimageCommand(sock, chatId, message) {
    try {
        const botName = getBotName();
        const senderId = message.key.participant || message.key.remoteJid;

        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nThis command is only available for the owner!` }, { quoted: createFakeContact(message) });
            return;
        }

        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ').slice(1).join(' ').trim();

        if (args.toLowerCase() === 'reset') {
            setMenuImage('');
            await sock.sendMessage(chatId, { text: `*${botName}*\nMenu image has been reset to default!` }, { quoted: createFakeContact(message) });
            return;
        }

        if (args && (args.startsWith('http://') || args.startsWith('https://'))) {
            setMenuImage(args);
            await sock.sendMessage(chatId, { text: `*${botName}*\nMenu image URL has been set!` }, { quoted: createFakeContact(message) });
            return;
        }

        if (!quotedMessage?.imageMessage) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nPlease reply to an image or provide an image URL!\n\nUsage:\n.menuimage (reply to image)\n.menuimage https://example.com/image.jpg\n.menuimage reset (restore default)` }, { quoted: createFakeContact(message) });
            return;
        }

        try {
            const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const assetsDir = path.join(__dirname, '..', 'assets');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            const imagePath = path.join(assetsDir, 'menuimage.jpg');
            fs.writeFileSync(imagePath, buffer);

            setMenuImage(imagePath);
            await sock.sendMessage(chatId, { text: `*${botName}*\nMenu image has been updated!` }, { quoted: createFakeContact(message) });
        } catch (downloadError) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nFailed to download image: ${downloadError.message}` }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in setmenuimage command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    setbotconfigCommand,
    setmenuimageCommand
};
