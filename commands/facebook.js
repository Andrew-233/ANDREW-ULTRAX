const axios = require('axios');
const { getBotName } = require('../lib/botConfig');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

const { createFakeContact } = require('../lib/fakeContact');
async function facebookCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const fakeQuoted = createFakeContact(message);

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook link for the video."
            }, { quoted: fakeQuoted });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook link for the video."
            }, { quoted: fakeQuoted });
        }

        const fbPatterns = [
            /https?:\/\/(?:www\.)?facebook\.com\//,
            /https?:\/\/fb\.watch\//,
            /https?:\/\/m\.facebook\.com\//,
            /https?:\/\/web\.facebook\.com\//,
            /https?:\/\/(?:www\.)?facebook\.com\/share\//
        ];

        const isValidUrl = fbPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid Facebook link. Please provide a valid Facebook video link."
            }, { quoted: fakeQuoted });
        }

        await sock.sendMessage(chatId, {
            react: { text: '↘️', key: message.key }
        });

        try {
            // ✅ Facebook download API
            const apiResponse = await axios.get(
                `https://apiskeith.top/download/fbdown?url=${encodeURIComponent(url)}`
            );
            const data = apiResponse.data;

            if (data && data.status && data.result && data.result.media.sd && data.result.media.hd) {
                const videoUrl = data.result.media.hd || data.result.media.sd;
                const caption = getBotName();

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
            console.error('Error in Facebook API:', error.message || error);
            await sock.sendMessage(chatId, {
                text: "Failed to download the Facebook video. Please try again later."
            }, { quoted: fakeQuoted });
        }
    } catch (error) {
        console.error('Error in facebookCommand:', error.message || error);
        await sock.sendMessage(chatId, {
            text: "An unexpected error occurred. Please try again."
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = facebookCommand;
