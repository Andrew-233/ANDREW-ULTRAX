const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
const { createFakeContact } = require('../lib/fakeContact');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'antibot.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2));
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('[Antibot] Failed to save config:', e.message);
    }
}

function getGroupConfig(config, chatId) {
    return config[chatId] || { enabled: false, knownBots: [] };
}

const BOT_NAME_PATTERNS = [
    /bot/i,
    /\bai\b/i,
    /assistant/i,
    /automate/i,
    /robot/i
];

function isSuspectedBot(name) {
    if (!name) return false;
    return BOT_NAME_PATTERNS.some(p => p.test(name));
}

async function handleAntibotCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return;
    }

    if (!isSenderAdmin && !message?.key?.fromMe) {
        await sock.sendMessage(chatId, {
            text: '❌ Only group admins can use antibot settings.'
        }, { quoted: message });
        return;
    }

    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const action = (parts[1] || '').toLowerCase();

    const config = loadConfig();
    const groupCfg = getGroupConfig(config, chatId);

    if (!action) {
        const status = groupCfg.enabled ? '✅ ON' : '❌ OFF';
        await sock.sendMessage(chatId, {
            text: `🤖 *Antibot Settings*\n\n` +
                  `Status: ${status}\n\n` +
                  `*Commands:*\n` +
                  `• \`antibot on\` — Enable auto-removal of bots\n` +
                  `• \`antibot off\` — Disable\n` +
                  `• \`antibot scan\` — Scan & remove bots now\n` +
                  `• \`antibot add <number>\` — Mark a number as a bot\n` +
                  `• \`antibot list\` — List known bots`
        }, { quoted: message });
        return;
    }

    switch (action) {
        case 'on': {
            groupCfg.enabled = true;
            config[chatId] = groupCfg;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '✅ Antibot enabled. Bots will be automatically removed when they join.'
            }, { quoted: message });
            break;
        }

        case 'off': {
            groupCfg.enabled = false;
            config[chatId] = groupCfg;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '✅ Antibot disabled.'
            }, { quoted: message });
            break;
        }

        case 'scan': {
            try {
                const adminStatus = await isAdmin(sock, chatId, senderId);
                if (!adminStatus.isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Bot must be an admin to remove members.'
                    }, { quoted: message });
                    return;
                }

                const meta = await sock.groupMetadata(chatId);
                const botJid = sock.user?.id?.replace(/:.*@/, '@') || '';
                const knownBots = groupCfg.knownBots || [];

                const botsFound = [];

                for (const participant of meta.participants) {
                    const jid = participant.id;
                    const cleanJid = jid.replace(/:.*@/, '@');

                    if (cleanJid === botJid) continue;
                    if (participant.admin === 'admin' || participant.admin === 'superadmin') continue;

                    const isKnownBot = knownBots.some(b => jid.includes(b) || cleanJid.includes(b));

                    let name = '';
                    try {
                        const contact = await sock.getContact(jid);
                        name = contact?.notify || contact?.name || '';
                    } catch (_) {}

                    if (isKnownBot || isSuspectedBot(name)) {
                        botsFound.push(jid);
                    }
                }

                if (botsFound.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: '✅ No bots detected in this group.'
                    }, { quoted: message });
                    return;
                }

                await sock.groupParticipantsUpdate(chatId, botsFound, 'remove');
                const numbers = botsFound.map(j => j.split('@')[0]).join(', ');
                await sock.sendMessage(chatId, {
                    text: `🤖 Removed ${botsFound.length} suspected bot(s):\n${numbers}`
                }, { quoted: message });
            } catch (e) {
                console.error('[Antibot] Scan error:', e.message);
                await sock.sendMessage(chatId, { text: '❌ Failed to scan for bots.' }, { quoted: message });
            }
            break;
        }

        case 'add': {
            const number = (parts[2] || '').replace(/[^0-9]/g, '');
            if (!number) {
                await sock.sendMessage(chatId, {
                    text: '❌ Usage: .antibot add <number>\nExample: .antibot add 1234567890'
                }, { quoted: message });
                return;
            }
            if (!Array.isArray(groupCfg.knownBots)) groupCfg.knownBots = [];
            if (groupCfg.knownBots.includes(number)) {
                await sock.sendMessage(chatId, { text: `⚠️ ${number} is already in the bot list.` }, { quoted: message });
                return;
            }
            groupCfg.knownBots.push(number);
            config[chatId] = groupCfg;
            saveConfig(config);
            await sock.sendMessage(chatId, { text: `✅ Added ${number} to the bot list.` }, { quoted: message });
            break;
        }

        case 'list': {
            const bots = groupCfg.knownBots || [];
            if (bots.length === 0) {
                await sock.sendMessage(chatId, { text: '📋 No bots in the list yet. Use `.antibot add <number>` to add.' }, { quoted: message });
                return;
            }
            const list = bots.map((b, i) => `${i + 1}. ${b}`).join('\n');
            await sock.sendMessage(chatId, { text: `🤖 *Known Bots:*\n\n${list}` }, { quoted: message });
            break;
        }

        default:
            await sock.sendMessage(chatId, {
                text: '❌ Unknown subcommand. Type `.antibot` to see available options.'
            }, { quoted: message });
    }
}

async function handleAntibotJoin(sock, chatId, participants) {
    try {
        const config = loadConfig();
        const groupCfg = getGroupConfig(config, chatId);
        if (!groupCfg.enabled) return;

        const botJid = sock.user?.id?.replace(/:.*@/, '@') || '';
        const knownBots = groupCfg.knownBots || [];
        const toRemove = [];

        for (const jid of participants) {
            const cleanJid = jid.replace(/:.*@/, '@');
            if (cleanJid === botJid) continue;

            const isKnownBot = knownBots.some(b => jid.includes(b) || cleanJid.includes(b));
            let name = '';
            try {
                const contact = await sock.getContact(jid);
                name = contact?.notify || contact?.name || '';
            } catch (_) {}

            if (isKnownBot || isSuspectedBot(name)) {
                toRemove.push(jid);
            }
        }

        if (toRemove.length > 0) {
            await sock.groupParticipantsUpdate(chatId, toRemove, 'remove');
            const numbers = toRemove.map(j => j.split('@')[0]).join(', ');
            await sock.sendMessage(chatId, {
                text: `🤖 Auto-removed ${toRemove.length} bot(s): ${numbers}`
            });
        }
    } catch (e) {
        console.error('[Antibot] Join handler error:', e.message);
    }
}

module.exports = { handleAntibotCommand, handleAntibotJoin };
