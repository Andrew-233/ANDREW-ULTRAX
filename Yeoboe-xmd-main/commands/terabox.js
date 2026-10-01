const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { createFakeContact } = require('../lib/fakeContact');
async function teraboxCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "📦", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text?.split(" ").slice(1).join(" ").trim();

        if (!url) {
            return sock.sendMessage(chatId, {
                text: "📦 *TeraBox Downloader*\n\nUsage:\n.terabox <terabox link>\n\nExample:\n.terabox https://1024terabox.com/s/xxxxx"
            }, { quoted: createFakeContact(message) });
        }

        const isValidTeraBoxUrl = (link) =>
            link.includes("terabox.com") ||
            link.includes("1024terabox.com") ||
            link.includes("teraboxapp.com") ||
            link.includes("terabox.app");

        if (!isValidTeraBoxUrl(url)) {
            return sock.sendMessage(chatId, {
                text: "❌ Invalid TeraBox link!\nPlease provide a valid TeraBox URL."
            }, { quoted: createFakeContact(message) });
        }

        await sock.sendMessage(chatId, { text: "⏳ Processing TeraBox link...\nFetching file info..." }, { quoted: createFakeContact(message) });

        // API call
        const apiUrl = `https://api.qasimdev.dpdns.org/api/terabox/download?apiKey=qasim-dev&url=${encodeURIComponent(url)}`;
        const apiResponse = await axios.get(apiUrl, { timeout: 60000, headers: { "User-Agent": "Mozilla/5.0" } });

        if (!apiResponse.data?.success || !apiResponse.data?.data?.files?.length) {
            return sock.sendMessage(chatId, {
                text: "❌ Download failed!\nNo files found or invalid link."
            }, { quoted: createFakeContact(message) });
        }

        const fileData = apiResponse.data.data;
        const file = fileData.files[0];
        const { title, size, downloadUrl, type } = file;

        await sock.sendMessage(chatId, {
            text: `📦 *TeraBox File*\n\n📄 Name: ${title}\n📊 Size: ${size}\n📁 Type: ${type}\n📂 Total Files: ${fileData.totalFiles}\n\n⏳ Downloading...`
        }, { quoted: createFakeContact(message) });

        // File setup
        const sanitizedTitle = title.replace(/[^a-z0-9.]/gi, "_").substring(0, 100);
        const filePath = path.join(tempDir, `${Date.now()}_${sanitizedTitle}`);

        // Download file
        const response = await axios({
            method: "GET",
            url: downloadUrl,
            responseType: "arraybuffer",
            timeout: 600000,
            headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://1024terabox.com/" }
        });

        fs.writeFileSync(filePath, response.data);

        // Check size
        const stats = fs.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        if (fileSizeInMB > 100) {
            fs.unlinkSync(filePath);
            return sock.sendMessage(chatId, {
                text: `❌ File too large!\nWhatsApp limit is 100MB.\nThis file is ${fileSizeInMB.toFixed(2)}MB.`
            }, { quoted: createFakeContact(message) });
        }

        // Determine type
        const ext = title.split(".").pop().toLowerCase();
        const videoExt = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "3gp"];
        const audioExt = ["mp3", "wav", "aac", "flac", "m4a", "ogg", "opus"];
        const imageExt = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];

        const buffer = fs.readFileSync(filePath);

        if (videoExt.includes(ext)) {
            await sock.sendMessage(chatId, {
                video: buffer,
                mimetype: "video/mp4",
                fileName: title,
                caption: `✅ Download Complete!\n📄 ${title}\n📊 ${size}`
            }, { quoted: createFakeContact(message) });
        } else if (audioExt.includes(ext)) {
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: title
            }, { quoted: createFakeContact(message) });
        } else if (imageExt.includes(ext)) {
            await sock.sendMessage(chatId, {
                image: buffer,
                caption: `✅ Download Complete!\n📄 ${title}\n📊 ${size}`
            }, { quoted: createFakeContact(message) });
        } else {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: "application/octet-stream",
                fileName: title,
                caption: `✅ Download Complete!\n📄 ${title}\n📊 ${size}`
            }, { quoted: createFakeContact(message) });
        }

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (fileData.totalFiles > 1) {
            await sock.sendMessage(chatId, {
                text: `ℹ️ Note: This link contains ${fileData.totalFiles} files.\nOnly the first file was downloaded.`
            }, { quoted: createFakeContact(message) });
        }

    } catch (error) {
        console.error("TeraBox command error:", error);
        return sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = teraboxCommand;
