const { createFakeContact } = require('../lib/fakeContact');
/**
 * Unmute a WhatsApp group by updating its settings
 * @param {object} sock - WhatsApp socket instance
 * @param {string} chatId - Group chat ID
 * @returns {Promise<object>} - Result object with status and message
 */
async function unmuteCommand(sock, chatId) {
    try {
        // Update group settings to allow normal conversation
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        // Fetch group metadata for a nicer confirmation message
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata?.subject || 'this group';

        // Send confirmation message
        await sock.sendMessage(chatId, { 
            text: `✅ ${groupName} has been unmuted. Members can now chat freely!` 
        }, { quoted: createFakeContact(message) });

        // Return success status
        return { success: true, message: `${groupName} unmuted successfully` };

    } catch (error) {
        console.error('Error unmuting group:', error);

        // Send error message to group
        await sock.sendMessage(chatId, { 
            text: `⚠️ Failed to unmute the group. Please try again later.` 
        }, { quoted: createFakeContact(message) });

        // Return failure status
        return { success: false, message: 'Failed to unmute group', error };
    }
}

module.exports = unmuteCommand;
