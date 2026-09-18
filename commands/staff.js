const { createFakeContact } = require('../lib/fakeContact');
async function staffCommand(sock, chatId, msg) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Get group profile picture
        let pp;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
        } catch {
            pp = 'https://i.imgur.com/2wzGhpF.jpeg'; // Default image
        }

        // Get admins from participants
        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(p => p.admin);
        const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n🔵 ');
        
        // Get group owner
        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || chatId.split('-')[0] + '@s.whatsapp.net';
        
        // Get owner details
        const ownerParticipant = participants.find(p => p.id === owner);
        const ownerName = ownerParticipant?.name || ownerParticipant?.notify || owner.split('@')[0];

        // Additional group information
        const groupCreation = new Date(groupMetadata.creation * 1000).toLocaleDateString();
        const groupDesc = groupMetadata.desc || 'No description available';
        const totalParticipants = participants.length;
        const adminCount = groupAdmins.length;

        // Create enhanced staff text with group info
        const text = `
ℹ️ *GROUP STAFF INFORMATION*

📛 *Group Name:* ${groupMetadata.subject}
👑 *Group Owner:* @${owner.split('@')[0]}
🆔 *Group JID:* ${chatId}
📅 *Created:* ${groupCreation}
👥 *Total Members:* ${totalParticipants}
🛡️ *Admin Count:* ${adminCount}

📝 *Group Description:*
${groupDesc}

┌───────── ADMIN LIST ────────
🔵 ${listAdmin}


💡 *Note:* Mentioning all admins for easy contact.
`.trim();

        // Send the message with image and mentions
        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: text,
            mentions: [...groupAdmins.map(v => v.id), owner]
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in staff command:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to get admin list! Error: ' + error.message 
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = staffCommand;
