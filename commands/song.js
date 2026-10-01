const yts = require('yt-search');
const axios = require('axios');
const { createFakeContact } = require('../lib/fakeContact');

async function songCommand(sock, chatId, message) {
       const fakekontak = createFakeContact(message);
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?"
            }, { quoted: fakekontak });
        }
        //react 
                await sock.sendMessage(chatId, {
            react: { text: "🎶", key: message.key }
        });

        let title = searchQuery;
        let audioUrl;

        // Supreme API is the primary audio downloader.
        try {
            const response = await axios.get(
                `https://apissupreme.vercel.app/media/play?apikey=supreme&query=${encodeURIComponent(searchQuery)}`,
                { timeout: 60000 }
            );
            if (response.data?.status && response.data?.downloadUrl) {
                audioUrl = response.data.downloadUrl;
                title = response.data.title || title;
            }
        } catch (primaryError) {
            console.warn('Supreme audio API failed for song command:', primaryError.message);
        }

        let video;
        if (!audioUrl) {
            // Existing search/provider remains as the fallback.
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: "No songs found!"
                }, { quoted: fakekontak });
            }
            video = videos[0];
            title = video.title;
            const response = await axios.get(
                `https://apiskeith.top/download/audio?url=${encodeURIComponent(video.url)}`,
                { timeout: 60000 }
            );
            if (!response.data?.status || !response.data?.result) {
                throw new Error('All audio download APIs failed');
            }
            audioUrl = typeof response.data.result === 'string'
                ? response.data.result
                : response.data.result.url;
        }

        // Notify user about download
        await sock.sendMessage(chatId, { 
            text: `_Playing 🎵_\n_${title} 🎶_`
        }, { quoted: fakekontak });

        if (!audioUrl) throw new Error('Download URL not found');

        // Send as audio (playable in chat)
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `🎵 *${title}*`
        }, { quoted: fakekontak });

        // Send also as document (downloadable file)
        await sock.sendMessage(chatId, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `🎵 *${title}*`
        }, { quoted: fakekontak });

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again later."
        }, { quoted: fakekontak });
    }
}

module.exports = songCommand;
