const fs = require('fs');
const path = require('path');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { createFakeContact } = require('../lib/fakeContact');
const { getOwnerNumber } = require('../lib/botConfig');

const COMMANDS_DIR = path.join(__dirname);
const MAX_MSG_LEN = 60000;

async function getcmdCommand(sock, chatId, msg, args) {
    try {
        const ownerNumber = String(getOwnerNumber() || '').replace(/[^0-9]/g, '');

        const allowedJids = new Set();
        if (ownerNumber) {
            allowedJids.add(jidNormalizedUser(`${ownerNumber}@s.whatsapp.net`));
        }

        const senderId = msg.key.participant || msg.key.remoteJid;
        const senderJid = jidNormalizedUser(senderId);
        const fake = createFakeContact(msg);

        // Restrict to the owner number (set with .setownernumber) and the bot itself
        if (!msg.key.fromMe && !allowedJids.has(senderJid)) {
            await sock.sendMessage(chatId, {
                text: 'âŒ Only the owner can use this command!'
            }, { quoted: fake });
            return;
        }

        // â”€â”€ Mode: .getcmd <name> â€” send file contents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (args && args.length > 0) {
            const target = args[0].replace(/\.js$/i, '').trim();
            const filePath = path.join(COMMANDS_DIR, `${target}.js`);

            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, {
                    text: `âŒ No command module named *${target}* found.`
                }, { quoted: fake });
                return;
            }

            const contents = fs.readFileSync(filePath, 'utf8');
            const header = `ðŸ“„ *${target}.js*\n${'â”'.repeat(20)}\n\n`;
            const full = header + contents;

            if (full.length <= MAX_MSG_LEN) {
                await sock.sendMessage(chatId, { text: full }, { quoted: fake });
            } else {
                // Split into chunks so we never exceed WhatsApp's limit
                let offset = 0;
                let part = 1;
                while (offset < full.length) {
                    const chunk = full.slice(offset, offset + MAX_MSG_LEN);
                    const label = part === 1 ? '' : `ðŸ“„ *${target}.js* (part ${part})\n\n`;
                    await sock.sendMessage(chatId, { text: label + chunk }, { quoted: fake });
                    offset += MAX_MSG_LEN;
                    part++;
                }
            }
            return;
        }

        // â”€â”€ Mode: .getcmd â€” show usage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await sock.sendMessage(chatId, {
            text: `ðŸ“„ *getcmd usage*\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\nSend the name of a command module to view its source code.\n\n*Example:* \`.getcmd yts\``
        }, { quoted: fake });

    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `âŒ Error: ${err.message}`
        }, { quoted: createFakeContact(msg) });
    }
}

module.exports = { getcmdCommand };
