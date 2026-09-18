const { createFakeContact } = require('../lib/fakeContact');
async function resetlinkCommand(sock, chatId, message) {
    try {
        // Check if it's a group chat
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: "❌ This command can only be used in groups!"
            }, { quoted: createFakeContact(message) });
        }

        // Get the sender's ID and group metadata
        const sender = message.key.participant || message.key.remoteJid;
        const metadata = await sock.groupMetadata(chatId);
        
        // Check if sender is an admin
        const isAdmin = metadata.participants.find(
            participant => participant.id === sender
        )?.admin;

        if (!isAdmin) {
            return await sock.sendMessage(chatId, {
                text: "⛔ This command is restricted to group admins only!"
            }, { quoted: createFakeContact(message) });
        }

        // Reset group invite link
        const newLink = await sock.groupRevokeInvite(chatId);
        const inviteLink = `https://chat.whatsapp.com/${newLink}`;
        
        await sock.sendMessage(chatId, {
            text: `✅ *Group Link Reset Successfully!*\n\n📱 *New Link:* ${inviteLink}\n\n⚠️ *Note:* Previous link has been deactivated.`
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error("Error resetting group link:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to reset group link. Make sure I have admin permissions."
        }, { quoted: createFakeContact(message) });
    }
}

async function linkCommand(sock, chatId, message) {
    try {
        // Check if it's a group chat
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: "❌ This command can only be used in groups!"
            }, { quoted: createFakeContact(message) });
        }

        // Get current group invite link
        const link = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
            text: `📱 *Group Invite Link:*\nhttps://chat.whatsapp.com/${link}\n\n🔗 *Share this link to invite others to the group.*`
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error("Error getting group link:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to get group link. Make sure I have admin permissions or the group has an active invite link."
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = {
    resetlinkCommand,
    linkCommand
};
