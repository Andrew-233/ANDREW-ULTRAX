async function blockCommand(sock, chatId, message) {
    try {
        // Owner check
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
        }

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const mentionedJid = contextInfo?.participant;
        const quotedMessage = contextInfo?.quotedMessage;

        if (!quotedMessage && !mentionedJid) {
            return sock.sendMessage(chatId, { 
                text: '❌ Please reply to a user\'s message to block them!\n\nUsage: Reply to user\'s message with !block',
                quoted: message
            });
        }

        const userToBlock = mentionedJid;
        if (!userToBlock) {
            return sock.sendMessage(chatId, { 
                text: '❌ Could not identify user to block!',
                quoted: message
            });
        }

        // Prevent blocking the bot itself
        const botId = sock.user.id.split('@')[0].split(':')[0];
        if (userToBlock.includes(botId)) {
            return sock.sendMessage(chatId, { 
                text: '❌ You cannot block the bot itself!',
                quoted: message
            });
        }

        await sock.updateBlockStatus(userToBlock, 'block');
        await sock.sendMessage(chatId, { 
            text: '✅ Successfully blocked user!',
            quoted: message
        });

        console.log(`✅ Blocked user: ${userToBlock}`);
    } catch (error) {
        console.error('Error in blockCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to block user!',
            quoted: message
        }).catch(() => {});
    }
}

async function blocklistCommand(sock, chatId, message) {
    try {
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
        }

        const blockedContacts = await sock.fetchBlocklist().catch(() => []);
        if (!blockedContacts.length) {
            return sock.sendMessage(chatId, { 
                text: '📋 No blocked contacts found.',
                quoted: message
            });
        }

        const totalBlocked = blockedContacts.length;
        const listText = blockedContacts
            .map(jid => `• ${jid.split('@')[0]}`)
            .slice(0, 20)
            .join('\n');

        let responseText = `📋 Blocked: ${totalBlocked}\n\n${listText}`;
        if (totalBlocked > 20) {
            responseText += `\n\n... and ${totalBlocked - 20} more`;
        }

        await sock.sendMessage(chatId, { 
            text: responseText,
            quoted: message
        });
    } catch (error) {
        console.error('Error in blocklistCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch blocklist!',
            quoted: message
        }).catch(() => {});
    }
}

async function unblockallCommand(sock, chatId, message) {
    try {
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
        }

        const blockedContacts = await sock.fetchBlocklist().catch(() => []);
        if (!blockedContacts.length) {
            return sock.sendMessage(chatId, { 
                text: '📋 No blocked contacts to unblock.',
                quoted: message
            });
        }

        await sock.sendMessage(chatId, { 
            text: `🔄 Unblocking ${blockedContacts.length} contacts...`,
            quoted: message
        });

        await Promise.all(
            blockedContacts.map(jid => sock.updateBlockStatus(jid, 'unblock').catch(() => null))
        );

        await sock.sendMessage(chatId, { 
            text: `✅ Unblocked ${blockedContacts.length} contacts!`,
            quoted: message
        });

        console.log(`✅ Unblocked ${blockedContacts.length} contacts`);
    } catch (error) {
        console.error('Error in unblockallCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to unblock contacts!',
            quoted: message
        }).catch(() => {});
    }
}

module.exports = {
    blockCommand,
    blocklistCommand,
    unblockallCommand
};
