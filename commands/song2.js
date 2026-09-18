
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

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "No songs found!"
            });
        }

        

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;

        // Fetch audio data from API
        const response = await axios.get(`https://api.goodnesstechhost.xyz/download/youtube/audio?url=${urlYt}`);
        const data = response.data;

        if (!data || !data.status || !data.result || !data.result.download_url) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch audio from the API. Please try again later."},{ quoted: message
            });
        }

        const audioUrl = data.result.download_url;
        const title = data.result.title;

        

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
