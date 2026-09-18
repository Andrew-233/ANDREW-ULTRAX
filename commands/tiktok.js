const axios = require('axios');
const { getBotName } = require('../lib/botConfig');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

const { createFakeContact } = require('../lib/fakeContact');
async function tiktokCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const fakeQuoted = createFakeContact(message); // ✅ Create once

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            }, { quoted: fakeQuoted });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            }, { quoted: fakeQuoted });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            }, { quoted: fakeQuoted });
        }

        // React with quoted fake contact
        await sock.sendMessage(chatId, {
            react: { text: '↘️', key: message.key }
        }, { quoted: fakeQuoted });

        try {
            // ✅ TikTok download API (video only)
            const apiResponse = await axios.get(
                `https://apiskeith.top/download/tiktokdl3?url=${encodeURIComponent(url)}`
            );
            const data = apiResponse.data;

            if (data && data.status && data.result) {
                const videoUrl = data.result;
                const caption = data.result.title || getBotName();

                // Send video with fake quoted contact
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: fakeQuoted });

            } else {
                return await sock.sendMessage(chatId, {
                    text: "Failed to fetch video. Please check the link or try again later."
                }, { quoted: fakeQuoted });
            }

        } catch (error) {
            console.error('Error in TikTok API:', error.message || error);
            await sock.sendMessage(chatId, {
                text: "Failed to download the TikTok video. Please try again later."
            }, { quoted: fakeQuoted });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error.message || error);
        await sock.sendMessage(chatId, {
            text: "An unexpected error occurred. Please try again."
        }, { quoted: fakeQuoted });
    }
}

module.exports = tiktokCommand;
