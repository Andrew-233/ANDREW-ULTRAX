const { isSudo } = require('../lib/index');
const { getBotName, updateConfig } = require('../lib/botConfig');

const { createFakeContact } = require('../lib/fakeContact');
async function setBotNameCommand(sock, chatId, message, args) {
    try {
        await sock.sendMessage(chatId, { react: { text: "⚙️", key: message.key } });

        const senderId = message.key.participant || message.key.remoteJid;

        if (!(message.key.fromMe || await isSudo(senderId))) {
            return sock.sendMessage(chatId, {
                text: "❌ Only bot owner can change bot name"
            }, { quoted: createFakeContact(message) });
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(' ').slice(1);

        if (parts.length < 1 || parts.join(' ').trim() === '') {
            const currentName = getBotName();
            return sock.sendMessage(chatId, {
                text: `📌 *Current bot name:* ${currentName}\n\nUsage: .setbotname <name>\nExample: .setbotname JUNE X\n\nTo reset: .setbotname reset`
            }, { quoted: createFakeContact(message) });
        }

        const newBotName = parts.join(' ').trim();

        if (newBotName.toLowerCase() === 'reset') {
            const settings = require('../settings');
            updateConfig({ botName: settings.botName });
            return sock.sendMessage(chatId, {
                text: `✅ Bot name reset to default: *${settings.botName}*`
            }, { quoted: createFakeContact(message) });
        }

        updateConfig({ botName: newBotName });

        return sock.sendMessage(chatId, {
            text: `✅ Bot name changed to: *${newBotName}*`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in setBotNameCommand:', error);
        return sock.sendMessage(chatId, {
            text: `❌ Error: ${error.message}`
        }, { quoted: createFakeContact(message) }).catch(() => {});
    }
}

module.exports = setBotNameCommand;
