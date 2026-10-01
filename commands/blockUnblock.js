const { isSudo } = require('../lib/index');
const { normalizeJid, resolvePhoneFromLid, isLid } = require('../lib/jid');

const delay = ms => new Promise(r => setTimeout(r, ms));

function jidToPhone(jid) {
    if (!jid) return '';
    return jid.split(':')[0].split('@')[0];
}

async function isOwnerOrSudo(sock, message) {
    if (message?.key?.fromMe === true) return true;
    const senderId = message?.key?.participant || message?.key?.remoteJid;
    if (!senderId) return false;
    return await isSudo(normalizeJid(senderId));
}

function getTargetFromMessage(message) {
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return normalizeJid(ctx.participant);
    if (ctx?.mentionedJid?.length) return normalizeJid(ctx.mentionedJid[0]);
    return null;
}

function getPhoneFromArgs(message) {
    const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const clean = text.trim().split(/\s+/).slice(1).join('').replace(/\D/g, '');
    return clean.length >= 6 ? clean : null;
}

function getBotJid(sock) {
    const raw = sock.user?.id || '';
    const num = raw.split(':')[0];
    return `${num}@s.whatsapp.net`;
}

/**
 * Resolve a @lid JID to @s.whatsapp.net via group metadata or session files.
 */
async function resolveLidToPhoneJid(sock, lidJid, chatId) {
    if (!isLid(lidJid)) return lidJid;

    const lidNum = lidJid.split('@')[0];

    // 1. Session file lookup
    const fromSession = resolvePhoneFromLid(lidNum);
    if (fromSession) return `${fromSession}@s.whatsapp.net`;

    // 2. Group metadata lookup
    if (chatId && chatId.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(chatId);
            for (const p of (meta?.participants || [])) {
                if (p.lid === lidJid && p.id && p.id.endsWith('@s.whatsapp.net')) {
                    return normalizeJid(p.id);
                }
                if (p.id === lidJid && p.lid && p.lid.endsWith('@s.whatsapp.net')) {
                    return normalizeJid(p.lid);
                }
            }
        } catch (_) {}
    }

    // 3. sock.contacts lookup
    try {
        const contacts = sock.contacts || {};
        for (const [key, val] of Object.entries(contacts)) {
            if ((val?.lid === lidJid || val?.id === lidJid) && key.endsWith('@s.whatsapp.net')) {
                return normalizeJid(key);
            }
        }
    } catch (_) {}

    return null;
}

/**
 * Look up a phone number on WhatsApp and return their real JID.
 * Returns null if not found or on error.
 */
async function resolvePhoneToJid(sock, phoneNumber) {
    try {
        const results = await sock.onWhatsApp(phoneNumber);
        if (results && results.length > 0 && results[0].exists) {
            return results[0].jid;
        }
    } catch (e) {
        console.error('[Block] onWhatsApp lookup failed:', e.message);
    }
    return null;
}

async function blockCommand(sock, chatId, message) {
    if (!(await isOwnerOrSudo(sock, message))) {
        return sock.sendMessage(chatId, {
            text: '❌ *Owner Only*\nThis command is reserved for the bot owner.'
        }, { quoted: message });
    }

    const botJid = getBotJid(sock);
    let target = null;
    let phone = null;

    const fromMsg = getTargetFromMessage(message);
    const fromArgs = getPhoneFromArgs(message);

    if (fromMsg) {
        // Target from reply or @mention — may be @lid
        let resolved = fromMsg;
        if (isLid(fromMsg)) {
            resolved = await resolveLidToPhoneJid(sock, fromMsg, chatId);
        }
        if (resolved && resolved.endsWith('@s.whatsapp.net')) {
            phone = jidToPhone(resolved);
            // Verify number is on WhatsApp and get their exact JID
            const verified = await resolvePhoneToJid(sock, phone);
            target = verified || resolved;
        } else if (!resolved) {
            // LID could not be resolved — ask user to type the number
            return sock.sendMessage(chatId, {
                text: `❌ *Cannot Block*\n\nCould not resolve this user's number.\n\n▸ Try: *.block ${phone || '2348012345678'}*`
            }, { quoted: message });
        }
    } else if (fromArgs) {
        // Target from typed phone number — verify it exists on WhatsApp
        const verified = await resolvePhoneToJid(sock, fromArgs);
        if (!verified) {
            return sock.sendMessage(chatId, {
                text: `❌ *Block Failed*\n\n+${fromArgs} is not found on WhatsApp.\n_Make sure the number includes the country code._`
            }, { quoted: message });
        }
        target = verified;
        phone = jidToPhone(target);
    } else {
        await sock.sendMessage(chatId, { react: { text: '❓', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `*🔒 Block a User*\n\n` +
                  `▸ Reply to their message and type *.block*\n` +
                  `▸ Mention them: *.block @user*\n` +
                  `▸ Type their number: *.block 2348012345678*`
        }, { quoted: message });
    }

    if (!target) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not resolve the target user.'
        }, { quoted: message });
    }

    if (normalizeJid(target) === normalizeJid(botJid)) {
        return sock.sendMessage(chatId, {
            text: '❌ You cannot block the bot itself.'
        }, { quoted: message });
    }

    try {
        await sock.updateBlockStatus(target, 'block');
        await sock.sendMessage(chatId, { react: { text: '🔒', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `🔒 *User Blocked*\n\n` +
                  `📱 Number : +${phone}\n` +
                  `📌 Status  : Blocked\n\n` +
                  `_This user can no longer message the bot._`
        }, { quoted: message });
    } catch (e) {
        console.error('[Block] updateBlockStatus error:', e.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `❌ *Block Failed*\n\nCould not block +${phone}.\n_Reason: ${e.message}_`
        }, { quoted: message });
    }
}

async function unblockCommand(sock, chatId, message) {
    if (!(await isOwnerOrSudo(sock, message))) {
        return sock.sendMessage(chatId, {
            text: '❌ *Owner Only*\nThis command is reserved for the bot owner.'
        }, { quoted: message });
    }

    let target = null;
    let phone = null;

    const fromMsg = getTargetFromMessage(message);
    const fromArgs = getPhoneFromArgs(message);

    if (fromMsg) {
        let resolved = fromMsg;
        if (isLid(fromMsg)) {
            resolved = await resolveLidToPhoneJid(sock, fromMsg, chatId);
        }
        if (resolved && resolved.endsWith('@s.whatsapp.net')) {
            phone = jidToPhone(resolved);
            const verified = await resolvePhoneToJid(sock, phone);
            target = verified || resolved;
        } else if (!resolved) {
            return sock.sendMessage(chatId, {
                text: `❌ *Cannot Unblock*\n\nCould not resolve this user's number.\n\n▸ Try: *.unblock ${phone || '2348012345678'}*`
            }, { quoted: message });
        }
    } else if (fromArgs) {
        const verified = await resolvePhoneToJid(sock, fromArgs);
        if (!verified) {
            return sock.sendMessage(chatId, {
                text: `❌ *Unblock Failed*\n\n+${fromArgs} is not found on WhatsApp.\n_Make sure the number includes the country code._`
            }, { quoted: message });
        }
        target = verified;
        phone = jidToPhone(target);
    } else {
        await sock.sendMessage(chatId, { react: { text: '❓', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `*🔓 Unblock a User*\n\n` +
                  `▸ Reply to their message and type *.unblock*\n` +
                  `▸ Mention them: *.unblock @user*\n` +
                  `▸ Type their number: *.unblock 2348012345678*`
        }, { quoted: message });
    }

    if (!target) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not resolve the target user.'
        }, { quoted: message });
    }

    try {
        const blocklist = await sock.fetchBlocklist().catch(() => []);
        const isBlocked = blocklist.some(j => normalizeJid(j) === normalizeJid(target));

        if (!isBlocked) {
            await sock.sendMessage(chatId, { react: { text: '⚠️', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `⚠️ *Not Blocked*\n\n+${phone} is not in the blocklist.`
            }, { quoted: message });
        }

        await sock.updateBlockStatus(target, 'unblock');
        await sock.sendMessage(chatId, { react: { text: '🔓', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `🔓 *User Unblocked*\n\n` +
                  `📱 Number : +${phone}\n` +
                  `📌 Status  : Unblocked\n\n` +
                  `_This user can now message the bot again._`
        }, { quoted: message });
    } catch (e) {
        console.error('[Unblock] updateBlockStatus error:', e.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `❌ *Unblock Failed*\n\nCould not unblock +${phone}.\n_Reason: ${e.message}_`
        }, { quoted: message });
    }
}

async function unblockallCommand(sock, chatId, message) {
    if (!(await isOwnerOrSudo(sock, message))) {
        return sock.sendMessage(chatId, {
            text: '❌ *Owner Only*\nThis command is restricted to the bot owner.'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '🔓', key: message.key } });

    const blocked = await sock.fetchBlocklist().catch(() => []);
    if (!blocked.length) {
        return sock.sendMessage(chatId, {
            text: '📭 No blocked contacts to unblock.'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `⏳ Unblocking ${blocked.length} contact(s)...`
    }, { quoted: message });

    let success = 0;
    for (const jid of blocked) {
        try {
            await sock.updateBlockStatus(jid, 'unblock');
            success++;
            await delay(400);
        } catch (e) {
            console.error('[Unblockall] Failed:', jid, e.message);
        }
    }

    await sock.sendMessage(chatId, {
        text: `🔓 *Unblock All Complete*\n\nSuccessfully unblocked: ${success}/${blocked.length} contacts.`
    }, { quoted: message });
}

async function blocklistCommand(sock, chatId, message) {
    if (!(await isOwnerOrSudo(sock, message))) {
        return sock.sendMessage(chatId, {
            text: '❌ *Owner Only*\nThis command is restricted to the bot owner.'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '📋', key: message.key } });

    const blocked = await sock.fetchBlocklist().catch(() => []);
    if (!blocked.length) {
        return sock.sendMessage(chatId, {
            text: '📭 *Blocklist Empty*\n\nNo contacts are currently blocked.'
        }, { quoted: message });
    }

    const lines = blocked.map((jid, i) => {
        const phone = jidToPhone(jid);
        return `${String(i + 1).padStart(2, '0')}. +${phone}`;
    });

    const chunks = [];
    const copy = [...lines];
    while (copy.length) chunks.push(copy.splice(0, 50));

    for (let i = 0; i < chunks.length; i++) {
        const header = i === 0 ? `🔒 *Blocked Contacts* (${blocked.length} total)\n\n` : '';
        await sock.sendMessage(chatId, {
            text: header + chunks[i].join('\n')
        }, { quoted: message });
        if (i < chunks.length - 1) await delay(500);
    }
}

module.exports = { blockCommand, unblockCommand, unblockallCommand, blocklistCommand };
