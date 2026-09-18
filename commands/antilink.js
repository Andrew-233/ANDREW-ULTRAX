const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { createFakeContact } = require('../lib/fakeContact');

// Link detection patterns — ordered from most specific to broadest
const LINK_PATTERNS = [
    /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i,           // WhatsApp group invite
    /wa\.me\/channel\/[A-Za-z0-9]{10,}/i,               // WhatsApp channel
    /t\.me\/[A-Za-z0-9_+]{2,}/i,                        // Telegram
    /https?:\/\/[^\s]{4,}/i,                             // Any http/https URL
    /(?<!\w)(www\.[a-z0-9-]+\.[a-z]{2,})[^\s]*/i,       // www.example.com
];

function containsLink(text) {
    if (!text || typeof text !== 'string') return false;
    return LINK_PATTERNS.some(pattern => pattern.test(text));
}

// Extract full text from any message type
function getMessageText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        message.message?.documentMessage?.caption ||
        ''
    );
}

/**
 * Handle Antilink Command
 * Signature matches main.js call: (sock, chatId, userMessage, senderId, isSenderAdmin, message)
 */
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin && !message?.key?.fromMe) {
            await sock.sendMessage(chatId, {
                text: '❌ Only group admins can use antilink settings.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Extract args from the original message text to avoid prefix-length issues
        const rawText = getMessageText(message);
        const parts = rawText.trim().split(/\s+/);
        // parts[0] is the command (e.g. ".antilink"), parts[1] onward are args
        const args = parts.slice(1).map(a => a.toLowerCase());
        const action = args[0];

        if (!action) {
            const config = await getAntilink(chatId, 'on');
            const status = config?.enabled ? '✅ ON' : '❌ OFF';
            const currentAction = config?.action || 'delete';
            await sock.sendMessage(chatId, {
                text: `🔗 *Antilink Settings*\n\n` +
                      `Status: ${status}\nAction: ${currentAction}\n\n` +
                      `*Commands:*\n` +
                      `• \`antilink on\` — Enable\n` +
                      `• \`antilink off\` — Disable\n` +
                      `• \`antilink set delete|kick|warn\` — Set action\n` +
                      `• \`antilink allow <link>\` — Whitelist a link\n` +
                      `• \`antilink disallow <link>\` — Remove whitelist\n` +
                      `• \`antilink get\` — Show current config`
            }, { quoted: createFakeContact(message) });
            return;
        }

        switch (action) {
            case 'on': {
                const existing = await getAntilink(chatId, 'on');
                if (existing?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ Antilink is already ON.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? '✅ Antilink enabled (default action: delete).' : '❌ Failed to enable antilink.'
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: '✅ Antilink disabled.'
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'set': {
                const mode = args[1];
                if (!['delete', 'kick', 'warn'].includes(mode)) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Invalid mode. Choose: `delete`, `kick`, or `warn`.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const result = await setAntilink(chatId, 'on', mode);
                await sock.sendMessage(chatId, {
                    text: result ? `✅ Antilink action set to *${mode}*.` : '❌ Failed to set action.'
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'get': {
                const config = await getAntilink(chatId, 'on');
                if (!config) {
                    await sock.sendMessage(chatId, {
                        text: '*Antilink Config*\nStatus: OFF\nAction: —\nAllowed links: 0'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const allowed = await getAntilink(chatId, 'allowed');
                const allowedList = Array.isArray(allowed) ? allowed : [];
                let text = `*Antilink Config*\n` +
                           `Status: ${config.enabled ? '✅ ON' : '❌ OFF'}\n` +
                           `Action: ${config.action || '—'}\n` +
                           `Allowed links: ${allowedList.length}`;
                if (allowedList.length > 0) {
                    text += '\n\n*Whitelisted:*\n' + allowedList.map((l, i) => `${i + 1}. ${l}`).join('\n');
                }
                await sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
                break;
            }

            case 'allow': {
                const link = parts.slice(2).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Usage: `antilink allow <link>`'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const config = await getAntilink(chatId, 'on');
                if (!config?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Enable antilink first with `antilink on`.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                let cleanLink;
                try {
                    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
                    cleanLink = (url.hostname + url.pathname).replace(/\/$/, '');
                } catch {
                    cleanLink = link.trim().toLowerCase();
                }
                const existing = await getAntilink(chatId, 'allowed') || [];
                const allowedList = Array.isArray(existing) ? existing : [];
                if (allowedList.includes(cleanLink)) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ Already whitelisted: \`${cleanLink}\``
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                allowedList.push(cleanLink);
                await setAntilink(chatId, 'allowed', allowedList);
                await sock.sendMessage(chatId, {
                    text: `✅ Whitelisted: \`${cleanLink}\``
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'disallow':
            case 'remove': {
                const link = parts.slice(2).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Usage: `antilink disallow <link>`'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const existing = await getAntilink(chatId, 'allowed') || [];
                const allowedList = Array.isArray(existing) ? existing : [];
                if (allowedList.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: '❌ No whitelisted links to remove.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const idx = allowedList.findIndex(a =>
                    a.toLowerCase().includes(link.toLowerCase()) ||
                    link.toLowerCase().includes(a.toLowerCase())
                );
                if (idx === -1) {
                    await sock.sendMessage(chatId, {
                        text: `❌ Link not found in whitelist: \`${link}\``
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const removed = allowedList.splice(idx, 1)[0];
                await setAntilink(chatId, 'allowed', allowedList);
                await sock.sendMessage(chatId, {
                    text: `✅ Removed from whitelist: \`${removed}\``
                }, { quoted: createFakeContact(message) });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: '❌ Unknown subcommand. Use `antilink` to see available options.'
                }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('[Antilink] Command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing antilink command.'
        }, { quoted: createFakeContact(message) });
    }
}

/**
 * Handle Link Detection (called per-message from main.js)
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const antilinkConfig = await getAntilink(chatId, 'on');
        if (!antilinkConfig?.enabled) return;

        // Check all text including captions
        const fullText = getMessageText(message);
        if (!containsLink(fullText)) return;

        // Skip admins — properly destructure isAdmin result
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin) return;

        // Check whitelist
        const allowedRaw = await getAntilink(chatId, 'allowed');
        const allowedLinks = Array.isArray(allowedRaw) ? allowedRaw : [];
        if (allowedLinks.length > 0) {
            const lowerText = fullText.toLowerCase();
            if (allowedLinks.some(a => lowerText.includes(a.toLowerCase()))) return;
        }

        const msgKey = {
            remoteJid: chatId,
            fromMe: false,
            id: message.key.id,
            participant: message.key.participant || senderId
        };

        switch (antilinkConfig.action) {
            case 'delete':
                try {
                    await sock.sendMessage(chatId, { delete: msgKey });
                    await sock.sendMessage(chatId, {
                        text: `🔗 @${senderId.split('@')[0]} Links are not allowed here.`,
                        mentions: [senderId]
                    });
                } catch (e) {
                    console.error('[Antilink] Delete failed:', e.message);
                }
                break;

            case 'kick':
                try {
                    await sock.sendMessage(chatId, { delete: msgKey });
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `🚫 @${senderId.split('@')[0]} was removed for posting a link.`,
                        mentions: [senderId]
                    });
                } catch (e) {
                    console.error('[Antilink] Kick failed:', e.message);
                    // Fallback to just delete
                    try { await sock.sendMessage(chatId, { delete: msgKey }); } catch (_) {}
                }
                break;

            case 'warn': {
                try { await sock.sendMessage(chatId, { delete: msgKey }); } catch (_) {}
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]} Warning: posting links is not allowed here.`,
                    mentions: [senderId]
                });
                break;
            }
        }
    } catch (error) {
        console.error('[Antilink] Detection error:', error);
    }
}

module.exports = { handleAntilinkCommand, handleLinkDetection };
