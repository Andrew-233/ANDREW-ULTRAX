const yts = require('yt-search');
const axios = require('axios');
const { createFakeContact } = require('../lib/fakeContact');

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        const fakekontak = createFakeContact(message);
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What video do you want to download?"
            }, { quoted: fakekontak });
        }

        // Search for the video
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "No videos found!"
            }, { quoted: fakekontak });
        }

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;
        const title = video.title; // ✅ Title from yt-search

        // Notify user about download
        await sock.sendMessage(chatId, { 
            text: `_Playing 🎥_\n_${title} 🎬_`
        }, { quoted: fakekontak });

        // Fetch video data from API
        const response = await axios.get(`https://apiskeith.top/download/video?url=${urlYt}`);
        const data = response.data;

        if (!data || !data.status) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch video from the API. Please try again later."
            }, { quoted: fakekontak });
        }

        const videoUrl = data.result; // ✅ API returns only the download URL

        // Send as video (playable in chat)
        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption: `🎬 *${title}*`
        }, { quoted: fakekontak });

        // Send also as document (downloadable file)
        await sock.sendMessage(chatId, {
            document: { url: videoUrl },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption: `🎬 *${title}*`
        }, { quoted: fakekontak });


    } catch (error) {
        console.error('Error in videoCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again later."
        }, { quoted: fakekontak });
    }
}

module.exports = videoCommand;
