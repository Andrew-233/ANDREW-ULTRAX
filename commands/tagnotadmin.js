const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function tagNotAdminCommand(sock, chatId, senderId, message) {
    try {
        const isOwner = message.key.fromMe || await isSudo(senderId);
        if (!isOwner) {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: createFakeContact(message) });
                return;
            }

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { text: 'Only admins can use the .tagnotadmin command.' }, { quoted: createFakeContact(message) });
                return;
            }
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        const nonAdmins = participants.filter(p => !p.admin).map(p => p.id);
        if (nonAdmins.length === 0) {
            await sock.sendMessage(chatId, { text: 'No non-admin members to tag.' }, { quoted: createFakeContact(message) });
            return;
        }

        // Get group profile picture
        let profilePicUrl;
        try {
            profilePicUrl = await sock.profilePictureUrl(chatId, 'image');
        } catch (error) {
            profilePicUrl = null; // No profile picture set
        }

        let text = `🏷️ *Tagging Non-Admins in ${groupMetadata.subject}*\n\n`;
        text += `📊 *Total Non-Admins:* ${nonAdmins.length}\n\n`;
        text += '🔊 *Hello Everyone:*\n\n';
        
        nonAdmins.forEach(jid => {
            text += `@${jid.split('@')[0]}\n`;
        });

        // Send message with group info and profile picture if available
        if (profilePicUrl) {
            await sock.sendMessage(chatId, {
                image: { url: profilePicUrl },
                caption: text,
                mentions: nonAdmins
            }, { quoted: createFakeContact(message) });
        } else {
            await sock.sendMessage(chatId, { 
                text, 
                mentions: nonAdmins 
            }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in tagnotadmin command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to tag non-admin members.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = tagNotAdminCommand;
