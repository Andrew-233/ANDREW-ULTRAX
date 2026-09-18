const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createFakeContact } = require('../lib/fakeContact');
const store = require('../lib/lightweight_store');

const BG_COLORS = [
    '#000000', '#1a1a2e', '#16213e', '#0f3460',
    '#533483', '#e94560', '#ff6b6b', '#ffd93d',
    '#6bcb77', '#4d96ff', '#845ec2', '#ff9671'
];

function randomBg() {
    return BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
}

function randomFont() {
    return Math.floor(Math.random() * 8);
}

// Build the full list of JIDs that should be able to see the status.
// Merges store contacts + private chat JIDs + the bot's own JID so the
// status is broadcast to every reachable contact, not just a subset.
function buildStatusJidList(sock) {
    const list = new Set();

    // All synced contacts
    const contacts = store.contacts || {};
    for (const jid of Object.keys(contacts)) {
        if (jid.endsWith('@s.whatsapp.net')) list.add(jid);
    }

    // Private chats (covers people who messaged the bot even if not in contacts)
    const chats = store.chats || {};
    for (const jid of Object.keys(chats)) {
        if (jid.endsWith('@s.whatsapp.net')) list.add(jid);
    }

    // Always include self
    if (sock?.user?.id) {
        const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        list.add(selfJid);
    }

    return [...list];
}

async function tostatusCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    try {
        await sock.sendMessage(chatId, { react: { text: '📤', key: message.key } });

        const rawText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption || '';

        const caption = rawText.trim().split(/\s+/).slice(1).join(' ').trim();

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (!caption && !quoted) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return await sock.sendMessage(chatId, {
                text: `*Usage:*\n` +
                      `◈ Reply to an image/video/audio with *.tostatus*\n` +
                      `◈ *.tostatus <text>* — post a text story\n` +
                      `◈ Reply + *.tostatus <caption>* — media with caption`
            }, { quoted: fake });
        }

        const statusJidList = buildStatusJidList(sock);

        if (quoted) {
            // Reconstruct quoted message key correctly:
            // remoteJid = the chat (not the participant), participant = sender in groups
            const quotedMsg = {
                key: {
                    remoteJid: chatId,
                    id: contextInfo.stanzaId,
                    fromMe: false,
                    participant: contextInfo.participant || undefined
                },
                message: quoted
            };

            const getBuffer = async () => downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            // Image
            if (quoted.imageMessage) {
                const buffer = await getBuffer();
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        image: buffer,
                        caption: caption || quoted.imageMessage?.caption || '',
                        mimetype: quoted.imageMessage?.mimetype || 'image/jpeg'
                    },
                    { statusJidList }
                );
                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
                return await sock.sendMessage(chatId, { text: '✅ Image posted to your story.' }, { quoted: fake });
            }

            // Video
            if (quoted.videoMessage) {
                const buffer = await getBuffer();
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        video: buffer,
                        caption: caption || quoted.videoMessage?.caption || '',
                        mimetype: quoted.videoMessage?.mimetype || 'video/mp4',
                        gifPlayback: false
                    },
                    { statusJidList }
                );
                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
                return await sock.sendMessage(chatId, { text: '✅ Video posted to your story.' }, { quoted: fake });
            }

            // Audio
            if (quoted.audioMessage) {
                const buffer = await getBuffer();
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        audio: buffer,
                        mimetype: quoted.audioMessage?.mimetype || 'audio/mp4',
                        ptt: false
                    },
                    { statusJidList }
                );
                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
                return await sock.sendMessage(chatId, { text: '✅ Audio posted to your story.' }, { quoted: fake });
            }

            // Text (quoted text or caption)
            const quotedText =
                quoted.conversation ||
                quoted.extendedTextMessage?.text || '';

            const textToPost = caption || quotedText;
            if (textToPost) {
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        text: textToPost,
                        backgroundColor: randomBg(),
                        font: randomFont()
                    },
                    { statusJidList }
                );
                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
                return await sock.sendMessage(chatId, { text: '✅ Text story posted.' }, { quoted: fake });
            }

            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return await sock.sendMessage(chatId, {
                text: '⚠️ Unsupported media type. Reply to an image, video, audio, or text message.'
            }, { quoted: fake });
        }

        // No quoted message — post caption as a text story
        await sock.sendMessage(
            'status@broadcast',
            {
                text: caption,
                backgroundColor: randomBg(),
                font: randomFont()
            },
            { statusJidList }
        );
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return await sock.sendMessage(chatId, { text: '✅ Text story posted.' }, { quoted: fake });

    } catch (err) {
        console.error('tostatusCommand error:', err);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return await sock.sendMessage(chatId, {
            text: `❌ Failed to post story: ${err.message || 'Unknown error'}`
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;
