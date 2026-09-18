const axios = require("axios");

const { createFakeContact } = require('../lib/fakeContact');
async function joinCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, { react: { text: "🔗", key: message.key } });

        // Extract query from direct or quoted message
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = text?.split(" ").slice(1).join(" ").trim();

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            query = quoted.conversation?.trim() || quoted.extendedTextMessage?.text?.trim();
        }

        if (!query) {
            return sock.sendMessage(chatId, {
                text: "🔗 Please provide a WhatsApp group invite link!\n\nExample: .join https://chat.whatsapp.com/IxMbtAN4lhVEhmbb6BfAsk\nOr quote a message containing the link"
            }, { quoted: createFakeContact(message) });
        }

        if (query.length > 200) {
            return sock.sendMessage(chatId, { text: "📝 Link too long! Max 200 chars." }, { quoted: createFakeContact(message) });
        }

        // Extract invite code
        let inviteCode;
        if (query.includes("chat.whatsapp.com/")) {
            inviteCode = query.split("chat.whatsapp.com/")[1].split(/[?/]/)[0];
        } else if (/^[A-Za-z0-9]{22}$/.test(query)) {
            inviteCode = query;
        } else {
            return sock.sendMessage(chatId, {
                text: "❌ Invalid WhatsApp group link format!\n\nProvide a link like: https://chat.whatsapp.com/IxMbtAN4lhVEhmbb6BfAsk\nOr just the code: IxMbtAN4lhVEhmbb6BfAsk"
            }, { quoted: createFakeContact(message) });
        }

        if (inviteCode.length !== 22) {
            return sock.sendMessage(chatId, { text: "❌ Invalid invite code length! WhatsApp codes should be 22 characters." }, { quoted: createFakeContact(message) });
        }

        // Fetch group info and accept invite with timeout
        const groupInfo = await Promise.race([
            sock.groupGetInviteInfo(inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout fetching group info")), 10000))
        ]);

        await Promise.race([
            sock.groupAcceptInvite(inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout joining group")), 10000))
        ]);

        const groupName = groupInfo?.subject || "Unknown Group";
        const groupInfoMessage = `✅ *Successfully Joined Group!*\n\n📌 *Name:* ${groupName}`;

        // Try sending group profile picture
        try {
            const ppUrl = await sock.profilePictureUrl(`${groupInfo.id}@g.us`, "image");
            if (ppUrl) {
                const ppResponse = await axios.get(ppUrl, { responseType: "arraybuffer", timeout: 10000 });
                await sock.sendMessage(chatId, { image: Buffer.from(ppResponse.data), caption: groupInfoMessage }, { quoted: createFakeContact(message) });
            } else {
                await sock.sendMessage(chatId, { text: groupInfoMessage }, { quoted: createFakeContact(message) });
            }
        } catch {
            await sock.sendMessage(chatId, { text: `${groupInfoMessage}` }, { quoted: createFakeContact(message) });
        }

        // Final success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
        console.log(`[JUNE-X] Successfully joined group: ${groupName}`);

    } catch (error) {
        console.error("[JUNE-X] Join command error:", error);

        let errorMessage = "❌ Failed to join group!";
        if (error.message.includes("Timeout")) errorMessage = "⏰ Request timeout. Please try again.";
        else if (/invite|expired/i.test(error.message)) errorMessage = "❌ The invite link is invalid or has expired!";
        else if (/already/i.test(error.message)) errorMessage = "⚠️ Bot is already in that group!";
        else if (/admin|not-authorized/i.test(error.message)) errorMessage = "❌ Bot is not authorized to join this group.";
        else if (/401|unauthorized/i.test(error.message)) errorMessage = "❌ Unauthorized access to group information.";
        else if (/500/i.test(error.message)) errorMessage = "❌ Server error. Please try again later.";

        return sock.sendMessage(chatId, { text: errorMessage }, { quoted: createFakeContact(message) });
    }
}

module.exports = joinCommand;
