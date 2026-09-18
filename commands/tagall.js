const isAdmin = require('../lib/isAdmin');

const { createFakeContact } = require('../lib/fakeContact');
async function tagAllCommand(sock, chatId, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin && !isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Only admins can use the .tagall command.'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: '❌ No participants found in the group.' }, { quoted: createFakeContact(message) });
            return;
        }

        // Get group profile picture
        let profilePictureUrl = null;
        try {
            const ppUrl = await sock.profilePictureUrl(chatId, 'image');
            profilePictureUrl = ppUrl;
        } catch (error) {
            console.log('Could not fetch group profile picture:', error.message);
            // Continue without profile picture
        }

        // Prepare the message with group info
        let message = `🏷️ *TAGGING ALL MEMBERS* 🏷️\n\n`;
        message += `💳 *Group Name:* ${groupMetadata.subject}\n`;
        message += `👥 *Total Members:* ${participants.length}\n`;
        message += `📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n\n`;
        message += `🔊 *Members List:*\n\n`;

        // Add participants with numbering
        participants.forEach((participant, index) => {
            const number = (index + 1).toString().padStart(2, '0');
            const username = participant.id.split('@')[0];
            const displayName = participant.name || participant.notify || username;
            
            // Add admin indicator
            const adminIndicator = participant.admin ? '[ADMIN👑]' : '';
            
            message += `${number}. @${username}${adminIndicator}\n`;
        });

        // Prepare message options
        const messageOptions = {
            text: message,
            mentions: participants.map(p => p.id)
        };

        // Add profile picture if available
        if (profilePictureUrl) {
            try {
                // Send image with caption
                await sock.sendMessage(chatId, {
                    image: { url: profilePictureUrl },
                    caption: message,
                    mentions: participants.map(p => p.id)
                }, { quoted: createFakeContact(message) });
                return;
            } catch (imageError) {
                console.log('Failed to send with image, sending text only:', imageError.message);
                // Fall back to text message if image fails
                await sock.sendMessage(chatId, messageOptions);
            }
        } else {
            // Send text message without image
            await sock.sendMessage(chatId, messageOptions);
        }

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to tag all members. Please try again later.' 
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = tagAllCommand;
