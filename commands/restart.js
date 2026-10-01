const { exec } = require("child_process");
const { isSudo } = require('../lib/index');
const { getBotName } = require('../lib/botConfig');

// Simple sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const { createFakeContact } = require('../lib/fakeContact');
module.exports = async function restartCommand(sock, chatId, message) {
    try {
        const sender = message.key.participant || message.key.remoteJid;

        if (!isSudo(sender)) {
            await sock.sendMessage(chatId, { text: "❌ Only the bot owner can use this command." }, { quoted: createFakeContact(message) });
            return;
        }

        await sock.sendMessage(chatId, { text: `🔄 Restarting ${getBotName()}...` }, { quoted: createFakeContact(message) });
        await sleep(1500);

        // Use npx to run the locally installed pm2 (from dependencies)
        exec("npx pm2 restart all", (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                let errorMsg = `❌ Restart failed: ${error.message}`;
                // Provide helpful hints based on error
                if (error.message.includes("not found") || error.message.includes("command not found")) {
                    errorMsg = "❌ pm2 is not available. Please ensure it's installed (npm install pm2) and try again, or run with 'npx pm2 restart all'.";
                }
                sock.sendMessage(chatId, { text: errorMsg }, { quoted: createFakeContact(message) })
                    .catch(err => console.error("Failed to send error message:", err));
            } else {
                // Success – note: if pm2 restarts the bot, this message may not actually be delivered
                sock.sendMessage(chatId, { text: "✅ Restart done" }, { quoted: createFakeContact(message) })
                    .catch(err => console.error("Failed to send restart done message:", err));
            }
        });
    } catch (e) {
        console.error("Restart command error:", e);
        await sock.sendMessage(chatId, { text: `⚠️ Error: ${e.message}` }, { quoted: createFakeContact(message) });
    }
};
