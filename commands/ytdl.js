const yts = require('yt-search');
const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function ytplayCommand(sock, chatId, message) {
    try {
        // Initial reaction 📺
        await sock.sendMessage(chatId, { react: { text: "📺", key: message.key } });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            await sock.sendMessage(chatId, { text: "Give me a YouTube link or title!" }, { quoted: createFakeContact(message) });
            return;
        }

        let videoUrl, videoInfo;
        if (/youtu\.?be|youtube\.com/.test(input)) {
            videoUrl = input;
            const { videos } = await yts({ videoId: input.split("v=")[1] });
            videoInfo = videos[0];
        } else {
            const { videos } = await yts(input);
            if (!videos.length) {
                await sock.sendMessage(chatId, { text: "No video found!" }, { quoted: createFakeContact(message) });
                return;
            }
            videoInfo = videos[0];
            videoUrl = videoInfo.url;
        }

        const res = await axios.get(`https://iamtkm.vercel.app/downloaders/ytmp4?apikey=tkm&url=${videoUrl}`);
        const dl = res.data?.data?.url;
        if (!dl) {
            await sock.sendMessage(chatId, { text: "Download failed." }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return;
        }

        await sock.sendMessage(chatId, {
            video: { url: dl },
            mimetype: "video/mp4",
            caption: `🎬 ${videoInfo.title}`
        }, { quoted: createFakeContact(message) });

        // Success reaction ✅
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        await sock.sendMessage(chatId, { text: "Error occurred while processing video." }, { quoted: createFakeContact(message) });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

async function ytsongCommand(sock, chatId, message) {
    try {
        // Initial reaction 🎵
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            await sock.sendMessage(chatId, { text: "Give me a YouTube link or song name!" }, { quoted: createFakeContact(message) });
            return;
        }

        let videoUrl, videoInfo;
        if (/youtu\.?be|youtube\.com/.test(input)) {
            videoUrl = input;
            const { videos } = await yts({ videoId: input.split("v=")[1] });
            videoInfo = videos[0];
        } else {
            const { videos } = await yts(input);
            if (!videos.length) {
                await sock.sendMessage(chatId, { text: "No song found!" }, { quoted: createFakeContact(message) });
                return;
            }
            videoInfo = videos[0];
            videoUrl = videoInfo.url;
        }

        const res = await axios.get(`https://api.zenzxz.my.id/download/youtube?q=${videoUrl}`);
        const dl = res.data?.result.download;
        if (!dl) {
            await sock.sendMessage(chatId, { text: "Download failed." }, { quoted: createFakeContact(message) });
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return;
        }

        await sock.sendMessage(chatId, {
            audio: { url: dl },
            mimetype: "audio/mpeg",
            fileName: `${videoInfo.title}.mp3`
        }, { quoted: createFakeContact(message) });

        // Success reaction ✅
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        await sock.sendMessage(chatId, { text: "Error occurred while processing song." }, { quoted: createFakeContact(message) });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = { ytplayCommand, ytsongCommand };
