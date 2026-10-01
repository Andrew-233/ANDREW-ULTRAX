const { createFakeContact } = require('../lib/fakeContact');
async function onlineCommand(sock, chatId, message) {
    try {
        // Only works in groups
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: '❌ This command can only be used in a group chat!'
            }, { quoted: createFakeContact(message) });
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        // Check admin
        const sender = message.key.participant || message.key.remoteJid;
        const senderInfo = participants.find(p => p.id === sender);
        const isAdmin = senderInfo?.admin === 'admin' || senderInfo?.admin === 'superadmin';
        if (!isAdmin) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only group admins can use this command!'
            }, { quoted: createFakeContact(message) });
        }

        const onlineMembers = new Set();
        let presenceHandler;

        try {
            const onlineCheckPromise = new Promise((resolve) => {
                presenceHandler = (update) => {
                    const { id, presences } = update;
                    const presence = presences?.[id]?.lastKnownPresence || update.presence;
                    if (['available', 'composing', 'recording', 'online'].includes(presence)) {
                        if (participants.some(p => p.id === id)) {
                            onlineMembers.add(id);
                        }
                    }
                };

                sock.ev.on('presence.update', presenceHandler);

                (async () => {
                    for (const participant of participants) {
                        try {
                            await sock.presenceSubscribe(participant.id);
                        } catch {}
                    }
                })();

                setTimeout(resolve, 6000); // short timeout
            });

            await onlineCheckPromise;
        } finally {
            if (presenceHandler) sock.ev.off('presence.update', presenceHandler);
        }

        // Results
        const totalMembers = participants.length;
        const onlineArray = Array.from(onlineMembers);
        const onlineCount = onlineArray.length;

        if (onlineCount === 0) {
            return await sock.sendMessage(chatId, {
                text: `👥 Online: 0 / ${totalMembers}\n⚠️ No online members detected.`,
                quoted: message
            });
        }

        // Build mentions list
        const mentions = onlineArray;
        const onlineList = onlineArray.map((id, i) => {
            const memberData = participants.find(p => p.id === id);
            const name = memberData?.pushname || memberData?.name || id.split('@')[0];
            return `${i + 1}. @${id.split('@')[0]}`;
        });

        const resultMessage = `🟢 Online Members (${onlineCount}/${totalMembers}):\n\n${onlineList.join('\n')}`;
        await sock.sendMessage(chatId, { text: resultMessage, mentions }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("Online command error:", error);
        await sock.sendMessage(chatId, {
            text: `❌ Online check failed: ${error.message || 'Unexpected error'}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = onlineCommand;
