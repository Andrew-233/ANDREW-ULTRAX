
//new song API 

const yts = require('yt-search');
const axios = require('axios');

async function song2Command(sock, chatId, message) {
    try {
         await sock.sendMessage(chatId, {
            react: {
                text: "🎵",
                key: message.key
            }
        });
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?"},{ quoted: message
            });
        }

        let audioUrl;
        let title = searchQuery;

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
            console.warn('Supreme audio API failed for song2 command:', primaryError.message);
        }

        if (!audioUrl) {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: "No songs found!"
                });
            }
            const video = videos[0];
            const response = await axios.get(
                `https://api.goodnesstechhost.xyz/download/youtube/audio?url=${encodeURIComponent(video.url)}`,
                { timeout: 60000 }
            );
            if (!response.data?.status || !response.data.result?.download_url) {
                throw new Error('All audio download APIs failed');
            }
            audioUrl = response.data.result.download_url;
            title = response.data.result.title || video.title;
        }

        if (!audioUrl) throw new Error('Download URL not found');

        // Send the audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });
        
        //successful react ✔️
       await sock.sendMessage(chatId, { react: { text: '💅', key: message.key } 
        });
       

    } catch (error) {
        console.error('Error in song2 command:', error);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again later."
        });
        
        //err react ❌
            await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = song2Command; 
