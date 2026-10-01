const { createFakeContact } = require('../lib/fakeContact');
const { getOwnerNumber, setOwnerNumber } = require('../lib/botConfig');

async function setOwnerNumberCommand(sock, chatId, message, args) {
    try {
        const isFromMe = message.key.fromMe;

        if (!isFromMe) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot itself can change the owner number.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const input = args.trim();

        if (!input) {
            const current = getOwnerNumber();
            const text = `
📱 *OWNER NUMBER SETTINGS*

*Current Owner Number:* +${current || 'Not set'}

*Usage:* \`.setownernumber <number>\`

*Examples:*
├─ \`.setownernumber 254792021944\`
└─ \`.setownernumber 12025550199\`

_Enter the number with country code, no + or spaces._
`.trim();
            await sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
            return;
        }

        // Strip leading + or spaces just in case
        const cleaned = input.replace(/^\+/, '').replace(/\s+/g, '');

        // Validate: digits only, reasonable length (7–15 digits)
        if (!/^\d{7,15}$/.test(cleaned)) {
            await sock.sendMessage(chatId, {
                text: `❌ *Invalid number:* \`${input}\`\n\nPlease enter digits only with country code, no + or spaces.\nExample: \`254792021944\``
            }, { quoted: createFakeContact(message) });
            return;
        }

        setOwnerNumber(cleaned);

        await sock.sendMessage(chatId, {
            text: `✅ *Owner number updated successfully!*\n\n📱 *New Owner Number:* +${cleaned}\n\n_This takes effect immediately — no restart needed._`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in setownernumber command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to update owner number.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = setOwnerNumberCommand;
