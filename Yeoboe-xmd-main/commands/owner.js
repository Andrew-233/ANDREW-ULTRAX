const settings = require('../settings');
const { getOwnerNumber } = require('../lib/botConfig');

const { createFakeContact } = require('../lib/fakeContact');
/**
 * Sends the owner's contact card to a given chat.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} chatId - The ID of the chat to send the vCard to.
 */
async function ownerCommand(sock, chatId) {
    try {
        const ownerNumber = String(getOwnerNumber() || '').replace(/\D/g, '');
        if (!ownerNumber) {
            await sock.sendMessage(chatId, { text: 'Owner number is not set yet. Use .setownernumber <number>' });
            return;
        }

        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${settings.botOwner}`,
            `TEL;waid=${ownerNumber}:+${ownerNumber}`,
            'END:VCARD',
        ].join('\n');

        await sock.sendMessage(chatId, {
            contacts: {
                displayName: settings.botOwner,
                contacts: [{ vcard }],
            },
        });

        console.log(`\x1b[35m[OWNER COMMAND]\x1b[0m Sent owner contact card to chat: ${chatId}`);
    } catch (error) {
        console.error('\x1b[35m[OWNER COMMAND ERROR]\x1b[0m', error);
    }
}

module.exports = ownerCommand;
