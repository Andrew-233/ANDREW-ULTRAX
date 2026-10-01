const { createFakeContact } = require('../lib/fakeContact');
const { getTimezone, setTimezone } = require('../lib/botConfig');

async function setTimezoneCommand(sock, chatId, message, args, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can change the timezone.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const newTz = args.trim();

        if (!newTz) {
            const current = getTimezone();
            const text = `
🌍 *TIMEZONE SETTINGS*

*Current Timezone:* ${current}

*Usage:* \`.settimezone <timezone>\`

*Examples:*
 settimezone Africa/Nairobi
 settimezone America/New_York
 settimezone Europe/London
 settimezone Asia/Dubai
 settimezone Asia/Kolkata

> Use standard IANA timezone names
`.trim();
            await sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
            return;
        }

        // Validate the timezone by trying to use it
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: newTz }).format(new Date());
        } catch {
            await sock.sendMessage(chatId, {
                text: `❌ *Invalid timezone:* \`${newTz}\`\n\nPlease use a valid IANA timezone name, e.g. _Africa/Nairobi_, _America/New_York_, _Europe/London_.`
            }, { quoted: createFakeContact(message) });
            return;
        }

        setTimezone(newTz);

        await sock.sendMessage(chatId, {
            text: `✅ *Timezone updated successfully!*\n\n🌍 *New Timezone:* ${newTz}\n\nUse *.time* to see the current time in your new timezone.`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in settimezone command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to update timezone.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = setTimezoneCommand;
