const isAdmin = require('../lib/isAdmin');

const { createFakeContact } = require('../lib/fakeContact');
async function addCommand(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { react: { text: "➕", key: message.key } });

    if (!chatId.endsWith('@g.us'))
      return sock.sendMessage(chatId, { text: "❌ Group only" }, { quoted: createFakeContact(message) });

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    
    // Check if text exists and contains numbers for phone extraction
    let target;
    if (text) {
      const extractedNumber = text.replace(/\D/g, '');
      if (extractedNumber.length === 0) {
        return sock.sendMessage(chatId, { 
          text: "📌 Usage: `.add 2547xxxxxxx` or reply to a user's message\n\n⚠️ *Please provide a phone number* (e.g., .add 254712345678)" 
        }, { quoted: createFakeContact(message) });
      }
      target = extractedNumber + '@s.whatsapp.net';
    } else if (message.quoted?.sender) {
      target = message.quoted.sender;
    } else {
      return sock.sendMessage(chatId, { 
        text: "📌 Usage: `.add 2547xxxxxxx` or reply to a user's message\n\n⚠️ *Please provide a phone number* (e.g., .add 254712345678)" 
      }, { quoted: createFakeContact(message) });
    }

    // Admin checks
    if (!await isAdmin(sock, chatId, sock.user.id)) 
      return sock.sendMessage(chatId, { text: "❌ I need admin rights" }, { quoted: createFakeContact(message) });

    const issuer = message.key.participant || message.key.remoteJid;
    if (!await isAdmin(sock, chatId, issuer))
      return sock.sendMessage(chatId, { text: "❌ Only admins can add" }, { quoted: createFakeContact(message) });

    // Get group metadata for subject
    const meta = await sock.groupMetadata(chatId);

    const res = await sock.groupParticipantsUpdate(chatId, [target], 'add');
    for (let r of res) {
      console.log("Add status:", r.status);

      const statusMsg = {
        408: "❌ Already in group",
        401: "🚫 I'm blocked",
        500: "❌ Invalid request"
      }[r.status];

      if (statusMsg)
        return sock.sendMessage(chatId, { text: statusMsg, mentions: [target] }, { quoted: createFakeContact(message) });

      if (r.status === 409) {
        // Recently left → pardon with invite
        const link = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
          text: `⚠️ @${target.split('@')[0]} left recently.\n📩 Invite link sent instead.`,
          mentions: [target]
        }, { quoted: createFakeContact(message) });
        return sock.sendMessage(target, {
          text: `📢 *Group Invitation*\n🏷️ ${meta.subject}\n🔗 https://chat.whatsapp.com/${link}`,
          detectLink: true
        });
      }

      if (r.status === 403) {
        // Privacy settings → invite link
        const link = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
          text: `@${target.split('@')[0]} has privacy settings.\n📩 Invite link sent.`,
          mentions: [target]
        }, { quoted: createFakeContact(message) });
        try {
          await sock.sendMessage(target, {
            text: `📢 *Group Invitation*\n🏷️ ${meta.subject}\n🔗 https://chat.whatsapp.com/${link}`,
            detectLink: true
          });
        } catch {
          await sock.sendMessage(chatId, { text: "❌ Failed to send invite" }, { quoted: createFakeContact(message) });
        }
        return;
      }

      // Success
      await sock.sendMessage(chatId, {
        text: `✅ Added @${target.split('@')[0]}!`,
        mentions: [target]
      }, { quoted: createFakeContact(message) });
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
  } catch (err) {
    console.error("AddCommand error:", err);
    const msg = /not authorized/.test(err.message) ? "❌ I'm not admin"
      : /not admin/.test(err.message) ? "❌ Only admins can add"
      : "⚠️ Could not add user!";
    await sock.sendMessage(chatId, { text: msg }, { quoted: createFakeContact(message) });
    await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
  }
}

module.exports = addCommand;
