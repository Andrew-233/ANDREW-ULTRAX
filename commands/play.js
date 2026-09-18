const yts = require('yt-search');
const axios = require('axios');
const { createFakeContact } = require('../lib/fakeContact');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        const fakekontak = createFakeContact(message);
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?"
            }, { quoted: fakekontak });
        }
        //react
                await sock.sendMessage(chatId, {
            react: { text: "🎼", key: message.key }
        });

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "No songs found!"
            }, { quoted: fakekontak });
        }

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;
        const title = video.title; // ✅ Title from yt-search

        // Notify user about download
        await sock.sendMessage(chatId, { 
            text: `_Downloading 🎵_\n_${title} 🎶_`
        }, { quoted: fakekontak });

        // Fetch audio data from API
        const response = await axios.get(`https://apiskeith.top/download/audio?url=${urlYt}`);
        const data = response.data;

        if (!data || !data.status) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch audio from the API. Please try again later."
            }, { quoted: fakekontak });
        }

        const audioUrl = data.result; // ✅ API returns only the download URL

        // Send as document
        await sock.sendMessage(chatId, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `🎵 *${title}*`
        }, { quoted: fakekontak });

    } catch (error) {
        console.error('Error in playCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again later."
        }, { quoted: fakekontak });
    }
}

module.exports = playCommand;
