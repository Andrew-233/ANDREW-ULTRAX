const { isAdmin } = require('../lib/isAdmin');

const { createFakeContact } = require('../lib/fakeContact');
async function promoteCommand(sock, chatId, mentionedJids, message, args) {
    let userToPromote = [];

    // Case 1: Mentioned users
    if (mentionedJids?.length > 0) {
        userToPromote = mentionedJids;
    }
    // Case 2: Quoted/replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    // Case 3: Direct number input (args after .promote)
    else if (args?.length > 0) {
        // Normalize number input to JID format
        userToPromote = args.map(num => {
            const cleanNum = num.replace(/[^0-9]/g, ''); // strip non-digits
            return `${cleanNum}@s.whatsapp.net`;
        });
    }

    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention, reply, or provide a number to promote!'
        }, { quoted: createFakeContact(message) });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");
        
        const promotedUsers = userToPromote.map(jid => `@${jid.split('@')[0]}`).join(', ');
        
        const promotionMessage = `Promoted: ${promotedUsers}`;
        
        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: userToPromote
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to promote user(s)!'}, { quoted: createFakeContact(message) });
    }
}

async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) return;

        const botJid = sock.user.id;
        const authorJid = typeof author === 'string' ? author : (author?.id || '');
        
        if (authorJid !== botJid) return;

        const promotedUsers = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || '');
            return `@${jidString.split('@')[0]}`;
        }).join(', ');
        
        const promotionMessage = `Promoted: ${promotedUsers}`;
        
        const mentionList = participants.map(jid => 
            typeof jid === 'string' ? jid : (jid.id || '')
        );

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: mentionList
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
