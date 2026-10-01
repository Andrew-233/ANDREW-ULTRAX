const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { webp2png } = require("../lib/webp2");
const webp = require("webp-converter");
const { createFakeContact } = require('../lib/fakeContact');

// Enable experimental features for webp-converter
webp.grant_permission();

async function gpteditCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "🖼️", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract prompt
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const prompt = text?.split(" ").slice(1).join(" ").trim();

        if (!prompt) {
            return sock.sendMessage(chatId, {
                text: "📷 *GPT Image Editor*\n\nReply to an *image* or *sticker* with a prompt.\n\nExample:\n.gptedit change the background to a beach"
            }, { quoted: createFakeContact(message) });
        }

        // Check quoted message
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctxInfo?.quotedMessage;
        if (!quotedMsg) {
            return sock.sendMessage(chatId, {
                text: "❌ Reply to an *image* or *sticker* with your prompt!"
            }, { quoted: createFakeContact(message) });
        }

        const isImage = !!quotedMsg.imageMessage;
        const isSticker = !!quotedMsg.stickerMessage;
        if (!isImage && !isSticker) {
            return sock.sendMessage(chatId, { text: "❌ Only images or static stickers are supported!" }, { quoted: createFakeContact(message) });
        }

        // Download media
        const targetMessage = {
            key: {
                remoteJid: chatId,
                id: ctxInfo.stanzaId,
                participant: ctxInfo.participant,
            },
            message: quotedMsg,
        };

        const mediaBuffer = await downloadMediaMessage(
            targetMessage,
            "buffer",
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
        );

        if (!mediaBuffer) {
            return sock.sendMessage(chatId, { text: "❌ Failed to download image. Try again." }, { quoted: createFakeContact(message) });
        }

        // Convert sticker to PNG if needed
        let imageBuffer = mediaBuffer;
        if (isSticker) {
            const stickerMessage = quotedMsg.stickerMessage;
            const isAnimated = stickerMessage.isAnimated || stickerMessage.mimetype?.includes("animated");
            if (isAnimated) {
                return sock.sendMessage(chatId, { text: "❌ Animated stickers are not supported." }, { quoted: createFakeContact(message) });
            }
            try {
                imageBuffer = await webp2png(mediaBuffer);
            } catch (err) {
                console.error("Sticker conversion error:", err);
                return sock.sendMessage(chatId, { text: "❌ Failed to convert sticker. Use a regular image." }, { quoted: createFakeContact(message) });
            }
        }

        // Convert to JPEG using webp-converter if needed
        let finalImageBuffer = imageBuffer;
        
        // Check if it's already a JPEG by looking at the magic numbers
        const isJPEG = imageBuffer.length > 2 && 
                      imageBuffer[0] === 0xFF && 
                      imageBuffer[1] === 0xD8 && 
                      imageBuffer[imageBuffer.length - 2] === 0xFF && 
                      imageBuffer[imageBuffer.length - 1] === 0xD9;
        
        const isPNG = imageBuffer.length > 8 && 
                     imageBuffer[0] === 0x89 && 
                     imageBuffer[1] === 0x50 && 
                     imageBuffer[2] === 0x4E && 
                     imageBuffer[3] === 0x47;

        // If not JPEG, convert using webp-converter
        if (!isJPEG) {
            try {
                // Save buffer to temp file
                const inputPath = path.join(tempDir, `input_${Date.now()}.${isPNG ? 'png' : 'webp'}`);
                const outputPath = path.join(tempDir, `output_${Date.now()}.jpg`);
                
                fs.writeFileSync(inputPath, imageBuffer);
                
                // Convert to JPEG using webp-converter
                if (isPNG) {
                    // For PNG files, use webp-converter's PNG to JPEG conversion
                    await webp.cwebp(inputPath, outputPath, "-q 90");
                } else {
                    // For other formats (likely WEBP), convert to JPEG
                    await webp.dwebp(inputPath, outputPath, "-o");
                }
                
                // Read converted file
                finalImageBuffer = fs.readFileSync(outputPath);
                
                // Clean up temp files
                try {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                } catch (cleanupErr) {
                    console.warn("Cleanup warning:", cleanupErr.message);
                }
            } catch (err) {
                console.error("webp-converter error:", err);
                // If conversion fails, use original buffer
                finalImageBuffer = imageBuffer;
            }
        }

        // Prepare form data
        const form = new FormData();
        form.append("image", finalImageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });
        form.append("param", prompt);

        // Call API
        const apiUrl = "https://api.nexray.web.id/ai/gptimage";
        const response = await axios.post(apiUrl, form, {
            headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" },
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: 10 * 1024 * 1024,
        });

        if (!response.data) {
            return sock.sendMessage(chatId, { text: "❌ No image received from API." }, { quoted: createFakeContact(message) });
        }

        const resultImageBuffer = Buffer.from(response.data);
        if (!resultImageBuffer || resultImageBuffer.length === 0) {
            return sock.sendMessage(chatId, { text: "❌ Empty image received from API." }, { quoted: createFakeContact(message) });
        }

        // Check size limit
        if (resultImageBuffer.length > 5 * 1024 * 1024) {
            return sock.sendMessage(chatId, {
                text: `❌ Image too large: ${(resultImageBuffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`
            }, { quoted: createFakeContact(message) });
        }

        // Notify user
        await sock.sendMessage(chatId, { text: `_✨ GPT Vision Result ready!_` }, { quoted: createFakeContact(message) });

        // Send edited image
        await sock.sendMessage(chatId, {
            image: resultImageBuffer,
            caption: `✨ *GPT Vision Result*\n\n📝 Prompt: ${prompt}`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("GPT Edit command error:", error);
        return sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = gpteditCommand;
