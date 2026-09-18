const { 
    setAntidemote, 
    getAntidemote, 
    removeAntidemote,
    revertLastAction,
    addKickRecord,
    getKickStats,
    incrementProtectedCount,
    addBannedUser,
    removeBannedUser,
    isUserBanned,
    ensureDataDir
} = require('../lib/antidemote-file');
const isAdmin = require('../lib/isAdmin');
const { normalizeJid, findParticipant, compareJids } = require('../lib/jid');
const { createFakeContact } = require('../lib/fakeContact');

const demoteCooldowns = new Map();

async function antidemoteCommand(sock, chatId, message, senderId) {
    try {
        await ensureDataDir();

        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '❌ This command can only be used in groups.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: createFakeContact(message) });
            return;
        }

        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || 
                    message.message?.imageMessage?.caption || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();
        const config = await getAntidemote(chatId);

        if (!action) {
            const usage = `🛡️ *ANTIDEMOTE COMMANDS*\n\n` +
                `• .antidemote on - Enable protection\n` +
                `• .antidemote off - Disable protection\n` +
                `• .antidemote status - Check status\n` +
                `• .antidemote revert - Undo last action\n` +
                `• .antidemote kick @user - Remove member\n` +
                `• .antidemote ban @user - Ban member\n` +
                `• .antidemote unban @user - Unban member\n` +
                `• .antidemote stats - View statistics`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: createFakeContact(message) });
            return;
        }

        switch (action) {
            case 'on':
                await setAntidemote(chatId, 'on', senderId);
                await sock.sendMessage(chatId, { 
                    text: '🛡️ *Antidemote Activated*\n\n✅ Admins are now protected from demotion!\n❌ No one can demote group admins.' 
                }, { quoted: createFakeContact(message) });
                break;

            case 'off':
                await removeAntidemote(chatId, senderId);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Antidemote Deactivated*\n\n⚠️ Admins can now be demoted normally.' 
                }, { quoted: createFakeContact(message) });
                break;

            case 'status':
            case 'get': {
                const statusConfig = await getAntidemote(chatId);
                const statusText = `🛡️ *ANTIDEMOTE STATUS*\n\n` +
                    `📌 Group: ${chatId.split('@')[0]}\n` +
                    `🔰 Status: ${statusConfig.enabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                    `🛡️ Protections: ${statusConfig.protectedCount || 0}\n` +
                    `👢 Total Kicks: ${statusConfig.kickCount || 0}\n` +
                    `📅 Last Updated: ${statusConfig.updatedAt ? new Date(statusConfig.updatedAt).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }) : 'Never'}\n\n` +
                    `${statusConfig.enabled ? '🟢 Admins are protected from demotion' : '🔴 No protection active'}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: createFakeContact(message) });
                break;
            }

            case 'revert':
            case 'undo': {
                const revertResult = await revertLastAction(chatId);
                await sock.sendMessage(chatId, { 
                    text: `🔄 *REVERT ${revertResult.success ? 'SUCCESSFUL' : 'FAILED'}*\n\n${revertResult.message}` 
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'kick': {
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please mention the user to kick.\n\n📝 *Usage:* `.antidemote kick @user`' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const mentionedKick = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[1].includes('@') ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!mentionedKick) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please mention a valid user with @.' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const groupMetadataKick = await sock.groupMetadata(chatId);
                const targetParticipant = findParticipant(groupMetadataKick.participants, mentionedKick);
                if (targetParticipant?.admin && config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '🛡️ *ANTIDEMOTE PROTECTION*\n\n❌ Cannot kick admins while antidemote is enabled!\n⚠️ Disable antidemote first with `.antidemote off`' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const cleanKick = normalizeJid(mentionedKick);
                const cleanSender = normalizeJid(senderId);
                if (compareJids(cleanKick, cleanSender)) {
                    await sock.sendMessage(chatId, { text: '❌ You cannot kick yourself!' }, { quoted: createFakeContact(message) });
                    return;
                }
                try {
                    await sock.groupParticipantsUpdate(chatId, [cleanKick], 'remove');
                    await addKickRecord(chatId, cleanKick, cleanSender, 'manual');
                    await sock.sendMessage(chatId, { 
                        text: `👢 *USER KICKED*\n\n✅ @${cleanKick.split('@')[0]} has been removed from the group.\n👮 Kicked by: @${cleanSender.split('@')[0]}`,
                        mentions: [cleanKick, cleanSender]
                    }, { quoted: createFakeContact(message) });
                } catch {
                    await sock.sendMessage(chatId, { text: '❌ Failed to kick user. Make sure I am an admin!' }, { quoted: createFakeContact(message) });
                }
                break;
            }

            case 'ban': {
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please mention the user to ban.\n\n📝 *Usage:* `.antidemote ban @user`' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const mentionedBan = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[1].includes('@') ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!mentionedBan) {
                    await sock.sendMessage(chatId, { text: '❌ Please mention a valid user with @.' }, { quoted: createFakeContact(message) });
                    return;
                }
                const groupMetadataBan = await sock.groupMetadata(chatId);
                const targetParticipantBan = findParticipant(groupMetadataBan.participants, mentionedBan);
                if (targetParticipantBan?.admin && config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '🛡️ *ANTIDEMOTE PROTECTION*\n\n❌ Cannot ban admins while antidemote is enabled!\n⚠️ Disable antidemote first with `.antidemote off`' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const cleanBan = normalizeJid(mentionedBan);
                const cleanSenderBan = normalizeJid(senderId);
                if (compareJids(cleanBan, cleanSenderBan)) {
                    await sock.sendMessage(chatId, { text: '❌ You cannot ban yourself!' }, { quoted: createFakeContact(message) });
                    return;
                }
                const alreadyBanned = await isUserBanned(chatId, cleanBan);
                if (alreadyBanned) {
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ @${cleanBan.split('@')[0]} is already banned.`,
                        mentions: [cleanBan]
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                try {
                    await sock.groupParticipantsUpdate(chatId, [cleanBan], 'remove');
                    await addBannedUser(chatId, cleanBan, cleanSenderBan, 'manual');
                    await addKickRecord(chatId, cleanBan, cleanSenderBan, 'ban');
                    await sock.sendMessage(chatId, { 
                        text: `🚫 *USER BANNED*\n\n✅ @${cleanBan.split('@')[0]} has been banned from the group.\n👮 Banned by: @${cleanSenderBan.split('@')[0]}\n📌 Use \`.antidemote unban\` to remove ban.`,
                        mentions: [cleanBan, cleanSenderBan]
                    }, { quoted: createFakeContact(message) });
                } catch {
                    await sock.sendMessage(chatId, { text: '❌ Failed to ban user. Make sure I am an admin!' }, { quoted: createFakeContact(message) });
                }
                break;
            }

            case 'unban': {
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please mention the user to unban.\n\n📝 *Usage:* `.antidemote unban @user`' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const mentionedUnban = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[1].includes('@') ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!mentionedUnban) {
                    await sock.sendMessage(chatId, { text: '❌ Please mention a valid user with @.' }, { quoted: createFakeContact(message) });
                    return;
                }
                const cleanUnban = normalizeJid(mentionedUnban);
                const unbanned = await removeBannedUser(chatId, cleanUnban);
                await sock.sendMessage(chatId, { 
                    text: unbanned
                        ? `✅ @${cleanUnban.split('@')[0]} has been unbanned and can now join the group.`
                        : `❌ @${cleanUnban.split('@')[0]} is not in the ban list.`,
                    mentions: [cleanUnban]
                }, { quoted: createFakeContact(message) });
                break;
            }

            case 'stats':
            case 'history': {
                const stats = await getKickStats(chatId);
                const groupMetadata = await sock.groupMetadata(chatId);
                let statsText = `📊 *ANTIDEMOTE STATISTICS*\n\n`;
                statsText += `👥 Group: ${groupMetadata.subject}\n`;
                statsText += `🆔 ID: ${chatId.split('@')[0]}\n\n`;
                statsText += `🛡️ *Protections:* ${stats.protectedCount || 0}\n`;
                statsText += `👢 *Total Kicks:* ${stats.totalKicks}\n`;
                statsText += `🚫 *Banned Users:* ${config.bannedUsers?.filter(b => b.active).length || 0}\n\n`;
                if (stats.recentKicks.length > 0) {
                    statsText += `*📋 RECENT ACTIONS (Last 5):*\n`;
                    stats.recentKicks.slice(0, 5).forEach((kick, i) => {
                        const date = new Date(kick.timestamp).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
                        const act = kick.reason === 'demote' ? '🛡️ Protected' : kick.reason === 'ban' ? '🚫 Banned' : '👢 Kicked';
                        statsText += `${i+1}. ${act}: @${kick.userId.split('@')[0]}\n`;
                        statsText += `   👮 By: @${kick.kickedBy?.split('@')[0] || 'System'}\n`;
                        statsText += `   📅 ${date}\n\n`;
                    });
                    const mentions = stats.recentKicks.slice(0, 5).flatMap(k => [k.userId, k.kickedBy]).filter(Boolean);
                    await sock.sendMessage(chatId, { text: statsText, mentions }, { quoted: createFakeContact(message) });
                } else {
                    statsText += `*📋 No recent actions recorded*`;
                    await sock.sendMessage(chatId, { text: statsText }, { quoted: createFakeContact(message) });
                }
                break;
            }

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ *Invalid Command*\n\nUse `.antidemote` to see all available commands.' 
                }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in antidemote command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command.\nPlease try again later.' 
        }, { quoted: createFakeContact(message) });
    }
}

async function handleAntidemote(sock, chatId, participants, author) {
    try {
        const config = await getAntidemote(chatId);
        if (!config.enabled) return false;

        const botJid = normalizeJid(sock.user?.id || '');
        const authorJid = normalizeJid(author);

        if (!authorJid) return false;
        if (compareJids(authorJid, botJid)) return false;

        const cooldownKey = `${chatId}:${authorJid}`;
        const now = Date.now();
        const lastAlert = demoteCooldowns.get(cooldownKey) || 0;
        if (now - lastAlert < 3000) {
            console.log(`[ANTIDEMOTE] Cooldown active for ${cooldownKey}, skipping duplicate`);
            return false;
        }
        demoteCooldowns.set(cooldownKey, now);

        const jids = participants
            .map(p => normalizeJid(typeof p === 'string' ? p : (p.id || '')))
            .filter(Boolean);

        if (jids.length === 0) return false;

        const adminStatus = await isAdmin(sock, chatId, authorJid);
        const isBotAdmin = adminStatus.isBotAdmin;

        const authorPhone = authorJid.split('@')[0];
        const mentionLines = jids.map(j => `  • @${j.split('@')[0]}`).join('\n');
        const plural = jids.length > 1 ? 's' : '';

        if (isBotAdmin) {
            try {
                await sock.groupParticipantsUpdate(chatId, jids, 'promote');
            } catch (err) {
                console.error(`[ANTIDEMOTE] Batch re-promote failed:`, err.message);
            }
            for (const jid of jids) {
                await addKickRecord(chatId, jid, authorJid, 'demote');
                await incrementProtectedCount(chatId);
            }
            await sock.sendMessage(chatId, {
                text: `🛡️ *ANTIDEMOTE ACTIVE*\n\n` +
                      `⚠️ @${authorPhone} tried to demote ${jids.length} admin${plural}!\n\n` +
                      `✅ Re-promoted back:\n${mentionLines}\n\n` +
                      `📌 Admins are protected in this group!`,
                mentions: [authorJid, ...jids]
            });
            console.log(`[ANTIDEMOTE] Re-promoted ${jids.length} participant(s) in ${chatId}`);
        } else {
            console.log(`[ANTIDEMOTE] Bot is not admin in ${chatId}, sending alert only`);
            await sock.sendMessage(chatId, {
                text: `🛡️ *ANTIDEMOTE ALERT*\n\n` +
                      `⚠️ @${authorPhone} tried to demote ${jids.length} admin${plural}!\n\n` +
                      `👇 Affected:\n${mentionLines}\n\n` +
                      `❗ Give me admin role to auto-reverse demotions!`,
                mentions: [authorJid, ...jids]
            });
        }

        return true;
    } catch (error) {
        console.error('Error in handleAntidemote:', error);
        return false;
    }
}

module.exports = {
    antidemoteCommand,
    handleAntidemote
};
