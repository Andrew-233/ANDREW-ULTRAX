const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

const { createFakeContact } = require('../lib/fakeContact');
async function xvdlCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🥵', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: '🎬 Provid a link or Name\nExample:\n\n xvdl sexy Red \nxvdl red One '
        }, { quoted: createFakeContact(message) });

        if (query.length > 100) return await sock.sendMessage(chatId, {
            text: `📝 Video name too long! Max 100 chars.`
        }, { quoted: createFakeContact(message) });


        const video = searchResult;
        const apiUrl = `https://api.giftedtech.co.ke/api/download/xvideosdl?apikey=gifted&url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.download_url) {
            throw new Error("API failed to fetch video!");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);
        const title = apiData.result.title;

        // Download MP4 video
        const videoResponse = await axios({
            method: "get",
            url: apiData.result.url,
            responseType: "stream",
            timeout: 600000
        });

        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Video download failed or empty file!");
        }

        // Get file size
        const fileSize = fs.statSync(filePath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

        // Send as document (video)
        await sock.sendMessage(chatId, {
            document: { url: apiData.result.url },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption:  ` *🎞️ Video Downloaded*\n\n *Title:* ${title}\n *Size:* ${fileSizeMB} MB`
        }, { quoted: createFakeContact(message) });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("ytdocvideo command error:", error);
        
        // Provide specific error messages
        let errorMessage = `🚫 Error: ${error.message}`;
        
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        } else if (error.message.includes("empty file")) {
            errorMessage = "📭 Download failed! Video might not be available.";
        }
        
        return await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = xvdlCommand;
