const fs = require('fs');
const path = require('path');

// Developer data
const settings = require('../settings');

const developers = [
    {
        name: settings.botOwner,
        phone: settings.developerNumber ? '+' + String(settings.developerNumber).replace(/\D/g, '') : ''
    }
].filter(d => d.phone);

async function developerCommand(sock, chatId, message) {
    try {
        if (!developers.length) {
            await sock.sendMessage(chatId, { text: '❌ Developer contact is not configured.' }, { quoted: message });
            return;
        }
        await sock.sendMessage(chatId, {
            text: '👨‍💻 Fetching developer contacts...'
        }, { quoted: message });

        // Create temp directory
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Send each developer as separate VCF
        for (const dev of developers) {
            const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:${dev.name}
TEL;TYPE=CELL:${dev.phone}
NOTE:Bot Developer
END:VCARD`;

            const fileName = `${dev.name.replace(/[^\w]/g, '_')}.vcf`;
            const filePath = path.join(tempDir, fileName);
            
            fs.writeFileSync(filePath, vcfContent, 'utf8');
            
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(filePath),
                fileName: fileName,
                mimetype: 'text/vcard'
            });

            // Delete file after sending
            fs.unlinkSync(filePath);
            
            // Small delay between sends
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Send summary message
        await sock.sendMessage(chatId, {
            text: `✅ *${developers.length} Developer Contacts Sent*\n\n` +
                  `💡 *How to import:*\n` +
                  `1. Download all .vcf files\n` +
                  `2. Open Contacts app\n` +
                  `3. Import from storage\n` +
                  `4. Select all vcf files\n\n` +
                  `*All contacts are in international format.*`
        }, { quoted: message });

    } catch (error) {
        console.error('Developer command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to send developer contacts.'
        }, { quoted: message });
    }
}

module.exports = developerCommand;
