const fs = require('fs');
const path = require('path');
const { jidDecode } = require('@whiskeysockets/baileys');
const { createFakeContact } = require('../lib/fakeContact');

const SESSION_DIR = path.join(__dirname, '..', 'session');

function decodeJid(jid) {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid);
        return decoded && decoded.user && decoded.server
            ? `${decoded.user}@${decoded.server}`
            : jid;
    }
    return jid;
}

function buildLidMap() {
    const map = {};
    try {
        const files = fs.readdirSync(SESSION_DIR);
        for (const file of files) {
            const match = file.match(/^lid-mapping-(\d+)_reverse\.json$/);
            if (!match) continue;
            const lidUser = match[1];
            try {
                const raw = fs.readFileSync(path.join(SESSION_DIR, file), 'utf8');
                const phone = JSON.parse(raw);
                if (typeof phone === 'string' && phone.length > 0) {
                    map[lidUser] = phone.replace(/\D/g, '');
                }
            } catch (_) {}
        }
    } catch (_) {}
    return map;
}

function normalizeNumber(raw) {
    let num = String(raw).replace(/\D/g, '');
    if (!num) return null;
    if (num.length < 7) return null;
    return num;
}

async function vcfCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: '❌ This command only works in groups!'
            }, { quoted: createFakeContact(message) });
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        if (participants.length < 2) {
            return await sock.sendMessage(chatId, {
                text: '❌ Group must have at least 2 members'
            }, { quoted: createFakeContact(message) });
        }

        const lidMap = buildLidMap();

        let vcfContent = '';
        let validCount = 0;
        let unresolved = 0;
        const seenNumbers = new Set();

        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            if (!participant.id) continue;

            const decodedId = decodeJid(participant.id);
            const isLid = decodedId.endsWith('@lid');
            const rawUser = decodedId.split('@')[0];

            let number = null;
            let resolved = false;

            if (isLid) {
                const mapped = lidMap[rawUser];
                if (mapped) {
                    number = normalizeNumber(mapped);
                    resolved = !!number;
                }
            } else {
                number = normalizeNumber(rawUser);
                resolved = !!number;
            }

            if (resolved && number) {
                if (seenNumbers.has(number)) continue;
                seenNumbers.add(number);

                const name = participant.name
                    || participant.notify
                    || `Member ${validCount + 1}`;

                vcfContent +=
`BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;TYPE=CELL:+${number}
NOTE:From ${groupMetadata.subject}
END:VCARD
`;
                validCount++;
            } else {
                unresolved++;
                const label = `Unknown Member ${validCount + unresolved}`;
                vcfContent +=
`BEGIN:VCARD
VERSION:3.0
FN:${label}
NOTE:From ${groupMetadata.subject} - Phone number not available (privacy protected)
END:VCARD
`;
            }
        }

        if (vcfContent.trim() === '') {
            return await sock.sendMessage(chatId, {
                text: '❌ No members found in this group!'
            }, { quoted: createFakeContact(message) });
        }

        const tempDir = path.join(__dirname, '../tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const safeName = groupMetadata.subject.replace(/[^\w]/g, '_');
        const filePath = path.join(tempDir, `${safeName}_${Date.now()}.vcf`);

        fs.writeFileSync(filePath, vcfContent.trim());

        const summary = unresolved > 0
            ? `✅ VCF generated!\n• ${validCount} members with phone numbers\n• ${unresolved} members with privacy-protected numbers (included without phone)`
            : `✅ VCF generated with all ${validCount} members!`;

        await sock.sendMessage(chatId, {
            document: fs.readFileSync(filePath),
            mimetype: 'text/vcard',
            fileName: `${safeName}_contacts.vcf`,
            caption: summary
        }, { quoted: createFakeContact(message) });

        fs.unlinkSync(filePath);

    } catch (err) {
        console.error('VCF COMMAND ERROR:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to generate VCF file!'
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = vcfCommand;
