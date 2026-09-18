const axios = require('axios');
const { sleep } = require('../lib/myfunc');

const { createFakeContact } = require('../lib/fakeContact');
async function pairCommand(sock, chatId, message) {
    try {
        // Extract text from incoming message
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            "";

        // Remove command prefix ".pair" and trim spaces
        const q = text.replace(/^\.pair\s*/i, "").trim();

        if (!q) {
            await sock.sendMessage(chatId, {
                text: "⚠️ *Oops!* You forgot the number 😅\n\n👉 Example:\n.pair 25678467XXXX",
                contextInfo: { forwardingScore: 1, isForwarded: false }
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
            return;
        }

        // Normalize and validate numbers
        const numbers = q.split(",")
            .map(v => v.replace(/[^0-9]/g, "")) // keep only digits
            .filter(v => v.length >= 6 && v.length <= 20);

        if (numbers.length === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ *Invalid number format!* 🚫\n\n👉 Please use digits only (6–20 digits).",
                contextInfo: { forwardingScore: 1, isForwarded: true }
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return;
        }

        for (const number of numbers) {
            const whatsappID = `${number}@s.whatsapp.net`;
            const result = await sock.onWhatsApp(whatsappID);

            if (!result?.[0]?.exists) {
                await sock.sendMessage(chatId, {
                    text: `🚫 Number *${number}* is not registered on WhatsApp ❌`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                });
                await sock.sendMessage(chatId, { react: { text: "🚫", key: message.key } });
                continue;
            }

            await sock.sendMessage(chatId, {
                text: `⏳ Generating code for: *${number}* 🔐`,
                contextInfo: { forwardingScore: 1, isForwarded: false }
            }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

            try {
                const response = await axios.get(
                    `https://andrewpair-a1114b3f512b.herokuapp.com//code?number=${number}`,
                    { timeout: 20000 }
                );

                const code = response.data?.code;
                if (!code || code === "Service Unavailable") {
                    throw new Error("Service Unavailable");
                }

                await sleep(3000);
                await sock.sendMessage(chatId, {
                    text: `${code}`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: createFakeContact(message) });
                await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

                // Fancy help message
                await sock.sendMessage(chatId, {
                    text: `📌 *How to Link ${number}*\n\n1️⃣ Copy the code above 🔝\n2️⃣ Open WhatsApp 📱\n3️⃣ Go to *Settings > Linked Devices* ⚙️\n4️⃣ Tap *Link a Device* 🔗\n5️⃣ Enter the code 🔑\n6️⃣ Wait for it to load ⏳\n7️⃣ Done! 🎉 Your device is now linked.\n\n💡 Use the *session_id* in your DM to deploy 🚀`,
                    contextInfo: { forwardingScore: 1, isForwarded: false }
                }, { quoted: createFakeContact(message) });

            } catch (apiError) {
                console.error("API Error:", apiError.message);
                const errorMessage =
                    apiError.message === "Service Unavailable"
                        ? "⚠️ Service is currently unavailable 🙏 Please try again later."
                        : "❌ Failed to generate pairing code 😔 Please try again later.";

                await sock.sendMessage(chatId, {
                    text: errorMessage,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: createFakeContact(message) });
                await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
            }
        }
    } catch (error) {
        console.error("Command Error:", error);
        await sock.sendMessage(chatId, {
            text: "💥 Unexpected error occurred 😵\n\nPlease try again later 🙏",
            contextInfo: { forwardingScore: 1, isForwarded: true }
        }, { quoted: createFakeContact(message) });
        await sock.sendMessage(chatId, { react: { text: "💥", key: message.key } });
    }
}

module.exports = pairCommand;
