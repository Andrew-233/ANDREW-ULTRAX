const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const config = require("../config");

const { createFakeContact } = require('../lib/fakeContact');
async function pinterestCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "📌", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return sock.sendMessage(chatId, {
                text: `📌 *Pinterest Downloader*\n\nUsage:\n${config.prefix}pinterest <Pinterest URL>\n\nExample:\n${config.prefix}pinterest https://in.pinterest.com/pin/1109363320773690068/`
            }, { quoted: createFakeContact(message) });
        }

        // Match Pinterest URLs
        let urlMatch = text.match(/https?:\/\/[^\s]*pinterest[^\s]*\/pin\/[^\s]+/i)
            || text.match(/https?:\/\/pin\.it\/[^\s]+/i)
            || text.match(/pin\.it\/[^\s]+/i);

        if (!urlMatch) {
            return sock.sendMessage(chatId, {
                text: "❌ Please provide a valid Pinterest pin URL!\n\nExamples:\n• https://in.pinterest.com/pin/1109363320773690068/\n• https://pin.it/dddddd"
            }, { quoted: createFakeContact(message) });
        }

        const pinterestUrl = urlMatch[0];

        await sock.sendMessage(chatId, { text: "⏳ Fetching Pinterest content..." }, { quoted: createFakeContact(message) });

        // Call API
        const apiUrl = `https://api.nexray.web.id/downloader/pinterest?url=${encodeURIComponent(pinterestUrl)}`;
        let response;
        try {
            response = await axios.get(apiUrl, {
                timeout: 30000,
                headers: { "User-Agent": "Mozilla/5.0" }
            });
        } catch (err) {
            console.error("Pinterest API Error:", err);
            return sock.sendMessage(chatId, { text: "❌ Failed to fetch Pinterest content. Try again later." }, { quoted: createFakeContact(message) });
        }

        if (!response.data?.status || !response.data?.result) {
            return sock.sendMessage(chatId, { text: "❌ Invalid response from API. Pin might not exist or be private." }, { quoted: createFakeContact(message) });
        }

        const pinData = response.data.result;
        const isVideo = !!pinData.video;
        const mediaUrl = pinData.video || pinData.image || pinData.url;
        const title = pinData.title || "Pinterest Pin";
        const author = pinData.author || "Unknown";

        if (!mediaUrl) {
            return sock.sendMessage(chatId, { text: "❌ No media URL found in API response." }, { quoted: createFakeContact(message) });
        }

        // Build caption
        let caption = `📌 *${title}*\n`;
        if (author !== "Unknown") caption += `👤 Author: ${author}\n`;
        caption += `\nDownloaded by ${config.botName}`;

        // Handle video
        if (isVideo) {
            try {
                const videoResponse = await axios.get(mediaUrl, {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.pinterest.com/" }
                });

                const videoBuffer = Buffer.from(videoResponse.data);
                if (!videoBuffer || videoBuffer.length < 100) throw new Error("Invalid video buffer");

                await sock.sendMessage(chatId, { video: videoBuffer, caption }, { quoted: createFakeContact(message) });
            } catch (err) {
                console.error("Video download error:", err);
                return sock.sendMessage(chatId, { text: "❌ Failed to download or send video." }, { quoted: createFakeContact(message) });
            }
        } else {
            // Handle image
            await sock.sendMessage(chatId, { image: { url: mediaUrl }, caption }, { quoted: createFakeContact(message) });
        }

    } catch (error) {
        console.error("Pinterest command error:", error);
        return sock.sendMessage(chatId, { text: `🚫 Error: ${error.message}` }, { quoted: createFakeContact(message) });
    }
}

module.exports = pinterestCommand;
