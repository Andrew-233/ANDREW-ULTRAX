/**
 * Magic Studio AI Art Generation Command
 * Generate AI-powered art from text prompts
 */

const axios = require("axios");

const BASE = "https://api.siputzx.my.id/api/ai/magicstudio";

const { createFakeContact } = require('../lib/fakeContact');
async function magicstudioCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "🎨", key: message.key } });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const args = text?.split(" ").slice(1).map(t => t.trim());
        const prompt = args?.join(" ").trim();

        if (!prompt) {
            return sock.sendMessage(chatId, {
                text: "❌ Usage: `.magicstudio <prompt>`\n\nExample: `.magicstudio a cyberpunk city`"
            }, { quoted: createFakeContact(message) });
        }

        // Notify user
        await sock.sendMessage(chatId, { text: `_🎨 Generating art... please wait_` }, { quoted: createFakeContact(message) });

        // Fetch image from API
        const url = `${BASE}?prompt=${encodeURIComponent(prompt)}`;
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*"
            },
            timeout: 120000 // 2 minutes timeout
        });

        const imageBuffer = Buffer.from(response.data);

        // Validate buffer
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error("Empty response from API");
        }

        // Check file size (WhatsApp limit 5MB)
        const maxImageSize = 5 * 1024 * 1024;
        if (imageBuffer.length > maxImageSize) {
            throw new Error(`Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`);
        }

        // Send generated image
        await sock.sendMessage(chatId, { image: imageBuffer }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("MagicStudio command error:", error);

        // Handle specific error cases
        let errorMsg;
        if (error.response?.status === 429) {
            errorMsg = "❌ Rate limit exceeded. Please try again later.";
        } else if (error.response?.status === 400) {
            errorMsg = "❌ Invalid prompt. Please try a different one.";
        } else if (error.response?.status === 500) {
            errorMsg = "❌ Server error. Please try again later.";
        } else if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
            errorMsg = "❌ Request timed out. The image generation took too long.";
        } else {
            errorMsg = `🚫 Error: ${error.message}`;
        }

        return sock.sendMessage(chatId, { text: errorMsg }, { quoted: createFakeContact(message) });
    }
}

module.exports = magicstudioCommand;
