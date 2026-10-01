const fs = require('fs');
const path = require('path');
const { createFakeContact } = require('../lib/fakeContact');

function getOwnerNumber() {
    try {
        const ownerPath = path.join(__dirname, '..', 'data', 'owner.json');
        if (fs.existsSync(ownerPath)) {
            const data = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
            if (data.ownerNumber) return data.ownerNumber.replace('@s.whatsapp.net', '');
        }
    } catch (e) {}
    return null;
}

function getSudoList() {
    try {
        const sudoPath = path.join(__dirname, '..', 'data', 'sudo.json');
        if (fs.existsSync(sudoPath)) {
            const data = JSON.parse(fs.readFileSync(sudoPath, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {}
    return [];
}

// Only convert true phone JIDs — never convert @lid JIDs
function toPhoneJid(jid) {
    if (!jid || typeof jid !== 'string') return null;
    if (jid.endsWith('@lid')) return null; // @lid can't be reliably converted
    const num = jid.split('@')[0].split(':')[0];
    if (!num || num.length < 7) return null;
    return `${num}@s.whatsapp.net`;
}

// Normalize a raw phone number string into a JID
function numberToJid(num) {
    const clean = num.replace(/[^0-9]/g, '');
    if (clean.length < 7) return null;
    return `${clean}@s.whatsapp.net`;
}

async function createGroupCommand(sock, chatId, senderId, message, rawText) {
    try {
        const ownerNum = getOwnerNumber();
        const senderNum = senderId.split('@')[0].split(':')[0];
        const sudoList = getSudoList();
        const isSudo = sudoList.includes(senderNum);
        const isFromMe = message.key.fromMe;
        const senderIsOwner = senderNum === ownerNum || isFromMe;

        if (!senderIsOwner && !isSudo) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the owner or sudo users can create groups.'
            }, { quoted: message });
            return;
        }

        // Strip the command word to get just the arguments
        const args = (rawText || '').replace(/^\S+\s*/, '').trim();

        if (!args) {
            await sock.sendMessage(chatId, {
                text: `📝 *Create Group Usage:*\n\n` +
                      `▸ *.creategroup <Name> | <numbers>*\n\n` +
                      `*Example:*\n.creategroup My Group | 2348012345678, 2348087654321\n\n` +
                      `You can also @mention members instead of typing numbers.`
            }, { quoted: message });
            return;
        }

        const parts = args.split('|').map(p => p.trim());
        const groupName = parts[0];

        if (!groupName) {
            await sock.sendMessage(chatId, {
                text: '❌ Please provide a group name.'
            }, { quoted: message });
            return;
        }

        // Collect participants from explicitly typed numbers
        let participants = [];
        if (parts[1]) {
            const raw = parts[1].split(',');
            for (const n of raw) {
                const jid = numberToJid(n.trim());
                if (jid) participants.push(jid);
            }
        }

        // Include @mentioned users (only real phone JIDs, skip @lid)
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentioned) {
            const phoneJid = toPhoneJid(jid);
            if (phoneJid && !participants.includes(phoneJid)) {
                participants.push(phoneJid);
            }
        }

        // Deduplicate
        participants = [...new Set(participants)];

        if (participants.length === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ Please provide at least one participant number.\n\n` +
                      `Example: *.creategroup My Group | 2348012345678*`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Creating group *${groupName}* with ${participants.length} member(s)...`
        }, { quoted: message });

        console.log('\x1b[35m[CREATEGROUP] Creating:', groupName, participants, '\x1b[0m');

        const group = await sock.groupCreate(groupName, participants);

        let inviteLink = '';
        try {
            const inviteCode = await sock.groupInviteCode(group.id);
            inviteLink = `\n🔗 https://chat.whatsapp.com/${inviteCode}`;
        } catch (e) {
            console.log('[CREATEGROUP] Could not get invite link:', e.message);
        }

        console.log('\x1b[35m[CREATEGROUP] Created:', group.id, '\x1b[0m');

        await sock.sendMessage(chatId, {
            text: `✅ Group *${groupName}* created!\n👥 Members added: ${participants.length}${inviteLink}`
        }, { quoted: message });

        // Welcome message inside the new group
        await sock.sendMessage(group.id, {
            text: `👋 Welcome to *${groupName}*!`
        });

    } catch (err) {
        console.error('\x1b[35m[CREATEGROUP] Error:\x1b[0m', err.message);

        let errText = '❌ Failed to create group.';
        if (err.message?.includes('bad-request')) {
            errText = `❌ Failed to create group: one or more numbers are not on WhatsApp or are invalid. Make sure all numbers include the country code (e.g. 2348012345678).`;
        } else {
            errText = `❌ Failed to create group: ${err.message || 'Unknown error'}`;
        }

        await sock.sendMessage(chatId, { text: errText }, { quoted: message });
    }
}

module.exports = { createGroupCommand };
