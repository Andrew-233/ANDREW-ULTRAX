const fs = require('fs');
const path = require('path');
const os = require('os');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function clearSessionCommand(sock, chatId, msg) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        if (!msg.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!'
            }, { quoted: msg });
            return;
        }

        // Define session directory
        const sessionDir = path.join(__dirname, '../session');

        if (!fs.existsSync(sessionDir)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Session directory not found!'
            }, { quoted: msg });
            return;
        }

        let filesCleared = 0;
        let errors = 0;
        let errorDetails = [];

        // Send initial status
        await sock.sendMessage(chatId, { 
            text: `🗝️ Optimizing session files for better performance...`
        }, { quoted: msg });

        const files = fs.readdirSync(sessionDir);
        
        // Count files by type for optimization
        let appStateSyncCount = 0;
        let preKeyCount = 0;

        for (const file of files) {
            if (file.startsWith('app-state-sync-')) appStateSyncCount++;
            if (file.startsWith('pre-key-')) preKeyCount++;
        }

        // Delete files
        for (const file of files) {
            if (file === 'creds.json') {
                // Skip creds.json file
                continue;
            }
            try {
                const filePath = path.join(sessionDir, file);
                fs.unlinkSync(filePath);
                filesCleared++;
            } catch (error) {
                errors++;
                errorDetails.push(`Failed to delete ${file}: ${error.message}`);
            }
        }

        // Send completion message
        const message = `✅ Session files cleared successfully!\n\n` +
                       `📊 Statistics:\n` +
                       `• Total files cleared: ${filesCleared}\n` +
                       `• App state sync files: ${appStateSyncCount}\n` +
                       `• Pre-key files: ${preKeyCount}\n` +
                       (errors > 0 ? `\n⚠️ Errors encountered: ${errors}\n${errorDetails.join('\n')}` : '');

        await sock.sendMessage(chatId, { 
            text: message
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in clearsession command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to clear session files!'
        }, { quoted: msg });
    }
}

module.exports = clearSessionCommand;
