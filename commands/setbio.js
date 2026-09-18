const { isSudo } = require('../lib/index');
const { proto } = require('@whiskeysockets/baileys');

// Helper to format uptime (milliseconds → days, hours, minutes, seconds)
const { createFakeContact } = require('../lib/fakeContact');
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

async function setBioCommand(sock, chatId, message, args) {
    const startTime = Date.now();

    try {
        // React to the command message
        await sock.sendMessage(chatId, { react: { text: "⚙️", key: message.key } });

        const senderId = message.key.participant || message.key.remoteJid;

        // Permission check
        if (!(message.key.fromMe || await isSudo(senderId))) {
            const runtime = Date.now() - startTime;
            return sock.sendMessage(chatId, { 
                text: `❌ Only bot owner can change bot bio (runtime: ${runtime}ms)` 
            }, { quoted: createFakeContact(message) });
        }

        // Extract command text
        const text = message.message?.conversation 
                  || message.message?.extendedTextMessage?.text 
                  || "";
        const parts = text.trim().split(/\s+/).slice(1);

        let newBio;
        if (parts.length === 0) {
            const runtime = Date.now() - startTime;
            return sock.sendMessage(chatId, { 
                text: `📌 Usage: .setbio <text> or .setbio default\n\nExample: .setbio I'm a helpful WhatsApp bot\n(runtime: ${runtime}ms)` 
            }, { quoted: createFakeContact(message) });
        } else {
            const input = parts.join(' ').trim();
            if (input.toLowerCase() === 'default') {
                const uptime = Date.now() - global.botStartTime;
                newBio = `JUNE MD running for ${formatUptime(uptime)}`;
            } else {
                newBio = input;
            }
        }

        // Update profile "about" (status)
        await sock.updateProfileStatus(newBio);

        const runtime = Date.now() - startTime;
        return sock.sendMessage(chatId, { 
            text: `✅ Bot bio changed to: *${newBio}*\n⏱️ Runtime: ${runtime}ms` 
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in setBioCommand:', error);
        const runtime = Date.now() - startTime;
        return sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}\n⏱️ Runtime: ${runtime}ms` 
        }, { quoted: createFakeContact(message) }).catch(() => {});
    }
}

module.exports = setBioCommand;
