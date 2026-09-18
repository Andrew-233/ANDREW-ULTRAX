const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { createFakeContact } = require('../lib/fakeContact');
const {
    jidNormalizedUser,
    jidDecode,
    isJidStatusBroadcast,
    isLidUser
} = require('@whiskeysockets/baileys');

/**
 * Resolve a @lid JID to its @s.whatsapp.net (PN) JID equivalent using the
 * LID-mapping stored in the session keys.  The mapping is written by Baileys
 * whenever it processes a message whose sender has both a LID and a PN, so
 * it is available as soon as we have decrypted at least one message from that
 * contact.
 *
 * Key format (stored by Baileys LIDMappingStore):
 *   keys.get('lid-mapping', [`${lidUser}_reverse`])  → pnUser (phone number)
 *
 * Returns the PN JID on success, or the original LID JID as fallback so the
 * send call is still attempted (Baileys may USync-resolve it).
 */
async function resolveLidToPN(sock, jid) {
    try {
        if (!isLidUser(jid)) return jid;
        const decoded = jidDecode(jid);
        if (!decoded?.user) return jid;
        const stored = await sock.authState.keys.get('lid-mapping', [`${decoded.user}_reverse`]);
        const pnUser = stored?.[`${decoded.user}_reverse`];
        if (!pnUser) return jid;                          // mapping not yet known — fall back
        const device = decoded.device || 0;
        return device ? `${pnUser}:${device}@s.whatsapp.net` : `${pnUser}@s.whatsapp.net`;
    } catch {
        return jid;
    }
}

const configPath = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = { enabled: false, reactOn: false };

function readConfig() {
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Merge with defaults so missing/empty files still have required fields
        return { ...DEFAULT_CONFIG, ...raw };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function writeConfig(cfg) {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

// Ensure the file exists and has valid content on startup
try {
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (typeof existing.enabled === 'undefined') {
        writeConfig({ ...DEFAULT_CONFIG, ...existing });
    }
} catch {
    writeConfig({ ...DEFAULT_CONFIG });
}

function isAutoStatusEnabled() { return !!readConfig().enabled; }
function isStatusReactionEnabled() { return !!readConfig().reactOn; }

const REACTION_EMOJIS = [
    '💞', '💘', '🥰', '💙', '💓', '💕',
    '❤️', '🧡', '💛', '💚', '💜', '❤️‍🔥',
    '😍', '🤩', '😘', '🥳', '😎', '🫶',
    '🔥', '✨', '💫', '⭐', '🌟', '🎉',
    '😂', '🤣', '👍', '💯', '🏆', '🚀'
];

function getEmoji() {
    const custom = readConfig().emoji;
    return custom || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
}

/**
 * Mark a status as viewed and optionally react to it.
 *
 * Official Baileys v7 pattern:
 *   await sock.readMessages([msg.key])
 *   await sock.sendMessage('status@broadcast',
 *       { react: { text: '💖', key: msg.key } },
 *       { statusJidList: [msg.key.participant, sock.user.id] }
 *   )
 *
 * The raw participant JID (even a @lid JID) is passed directly —
 * Baileys resolves and encrypts for the correct device internally.
 */
async function processStatusMessage(sock, msg) {
    const msgKey = msg?.key;
    if (!msgKey?.id) return;
    if (!isJidStatusBroadcast(msgKey.remoteJid)) return;
    if (msgKey.fromMe) return;

    const participant = msgKey.participant;

    // Give Baileys a moment to finish storing the message
    await new Promise(r => setTimeout(r, 500));

    // ── Step 1: Mark status as viewed ──────────────────────────────────────
    try {
        await sock.readMessages([msgKey]);
    } catch (err) {
        if (err?.message?.includes('rate-overlimit')) {
            await new Promise(r => setTimeout(r, 3000));
            try { await sock.readMessages([msgKey]); } catch { /* ignore */ }
        }
        // All other errors are silently ignored — the status was still seen
    }

    // ── Step 2: React if enabled ────────────────────────────────────────────
    if (!isStatusReactionEnabled()) return;

    if (!participant) return;

    const myId = sock.user?.id;
    if (!myId) return;

    // Resolve @lid JIDs → @s.whatsapp.net so Baileys can encrypt correctly.
    // WhatsApp delivers reactions using phone-number JIDs; passing a raw @lid
    // causes the sendMessage call to succeed internally but the server silently
    // drops the reaction because encryption is addressed to the wrong identity.
    const resolvedParticipant = await resolveLidToPN(sock, participant);

    const statusJidList = [resolvedParticipant, jidNormalizedUser(myId)]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);  // deduplicate

    try {
        await sock.sendMessage(
            'status@broadcast',
            { react: { text: getEmoji(), key: msgKey } },
            { statusJidList }
        );
    } catch { /* ignore reaction errors */ }
}

/**
 * Main handler — called for every messages.upsert event that contains
 * status@broadcast messages.
 *
 * Accepts either:
 *   • chatUpdate object  { messages: [...], type: '...' }
 *   • bare message object { key: {...}, ... }
 */
async function handleStatusUpdate(sock, statusUpdate) {
    try {
        if (!isAutoStatusEnabled()) return;

        // Shape 1: chatUpdate with a messages array
        if (Array.isArray(statusUpdate?.messages)) {
            for (const msg of statusUpdate.messages) {
                if (isJidStatusBroadcast(msg?.key?.remoteJid)) {
                    await processStatusMessage(sock, msg);
                }
            }
            return;
        }

        // Shape 2: bare message object
        if (statusUpdate?.key && isJidStatusBroadcast(statusUpdate.key.remoteJid)) {
            await processStatusMessage(sock, statusUpdate);
        }
    } catch { /* ignore top-level errors */ }
}

// ─── Command handler ───────────────────────────────────────────────────────────
async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const fake = createFakeContact(msg);
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Only the owner can use this!' }, { quoted: fake });
            return;
        }

        const config = readConfig();

        if (!args || args.length === 0) {
            const emojiDisplay = config.emoji || 'random 🎲';
            await sock.sendMessage(chatId, {
                text: `🔄 *Auto Status*\n\n` +
                      `📱 Auto View: *${config.enabled ? 'ON ✅' : 'OFF ❌'}*\n` +
                      `💫 Auto React: *${config.reactOn ? 'ON ✅' : 'OFF ❌'}*\n` +
                      `😀 React Emoji: *${emojiDisplay}*\n\n` +
                      `*Commands:*\n` +
                      `• \`.autostatus on\` — Enable viewing\n` +
                      `• \`.autostatus off\` — Disable viewing\n` +
                      `• \`.autostatus react on\` — Enable reactions\n` +
                      `• \`.autostatus react off\` — Disable reactions\n` +
                      `• \`.autostatus set 🔥\` — Set reaction emoji\n` +
                      `• \`.autostatus set random\` — Use random emoji`
            }, { quoted: fake });
            return;
        }

        const cmd = args[0].toLowerCase();

        if (cmd === 'on') {
            config.enabled = true;
            writeConfig(config);
            await sock.sendMessage(chatId, { text: '✅ Auto status view enabled!' }, { quoted: fake });

        } else if (cmd === 'off') {
            config.enabled = false;
            writeConfig(config);
            await sock.sendMessage(chatId, { text: '❌ Auto status view disabled!' }, { quoted: fake });

        } else if (cmd === 'react') {
            const sub = args[1]?.toLowerCase();
            if (sub === 'on') {
                config.reactOn = true;
                writeConfig(config);
                await sock.sendMessage(chatId, { text: '💫 Auto status reactions enabled!' }, { quoted: fake });
            } else if (sub === 'off') {
                config.reactOn = false;
                writeConfig(config);
                await sock.sendMessage(chatId, { text: '❌ Auto status reactions disabled!' }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Use: `.autostatus react on` or `.autostatus react off`'
                }, { quoted: fake });
            }

        } else if (cmd === 'set') {
            const value = args[1];
            if (!value) {
                await sock.sendMessage(chatId, {
                    text: '❌ Use: `.autostatus set 🔥` or `.autostatus set random`'
                }, { quoted: fake });
                return;
            }
            if (value.toLowerCase() === 'random') {
                delete config.emoji;
                writeConfig(config);
                await sock.sendMessage(chatId, {
                    text: '🎲 Reaction emoji set to *random*.'
                }, { quoted: fake });
            } else if (/\p{Emoji}/u.test(value)) {
                config.emoji = value;
                writeConfig(config);
                await sock.sendMessage(chatId, {
                    text: `✅ Reaction emoji set to *${value}*`
                }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Not a valid emoji. Try: `.autostatus set 🔥`'
                }, { quoted: fake });
            }

        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Unknown option.\n\nUse:\n`.autostatus on/off`\n`.autostatus react on/off`\n`.autostatus set 🔥`'
            }, { quoted: fake });
        }

    } catch (err) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + err.message }, { quoted: createFakeContact(msg) });
    }
}

module.exports = { autoStatusCommand, handleStatusUpdate };
