async function playCommand(sock, chatId, message) {
    try {
        // React to the command first
        await sock.sendMessage(chatId, {
            react: {
                text: "🎵",
                key: message.key
            }
        });

        const axios = require('axios');
        const yts = require('yt-search');
        const BASE_URL = 'https://noobs-api.top';

        // Extract query from message
        const q = message.message?.conversation || 
                  message.message?.extendedTextMessage?.text || 
                  message.message?.imageMessage?.caption || 
                  message.message?.videoMessage?.caption || '';
        
        const args = q.split(' ').slice(1);
        const query = args.join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '*🎵 Audio Player*\nPlease provide a song name to play.*'
            }, { quoted: message });
        }

        console.log('[PLAY] Searching YT for:', query);
        const search = await yts(query);
        const video = search.videos[0];

        if (!video) {
            return await sock.sendMessage(chatId, {
                text: '*❌ No Results Found*\nNo songs found for your query. Please try different keywords.*'
            }, { quoted: message });
        }

        const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
        const fileName = `${safeTitle}.mp3`;
        const apiURL = `${BASE_URL}/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp3`;

        // Create single button for getting video
        const buttonMessage = {
            image: { url: video.thumbnail },
            caption: `
🎵 *NOW PLAYING* 🎵

🎶 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views}
📅 *Uploaded:* ${video.ago}
🔗 *YouTube ID:* ${video.videoId}

⬇️ *Downloading your audio...* ⬇️

💡 *Tip:* Use *.video to get the video version*
            `.trim(),
            footer: 'CaseyRhodes Mini - Audio Player',
            buttons: [
                {
                    buttonId: '.video ' + video.title,
                    buttonText: { displayText: '🎬 Get Video' },
                    type: 1
                }
            ],
            headerType: 1
        };

        // Send song description with thumbnail and single button
        await sock.sendMessage(chatId, buttonMessage, { quoted: message });

        // Get download link
        const response = await axios.get(apiURL, { timeout: 30000 });
        const data = response.data;

        if (!data.downloadLink) {
            return await sock.sendMessage(chatId, {
                text: '*❌ Download Failed*\nFailed to retrieve the MP3 download link. Please try again later.*'
            }, { quoted: message});
        }

        // Send audio file
        await sock.sendMessage(chatId, {
            audio: { url: data.downloadLink },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            caption: `✅ *Download Complete!*\n🎵 ${video.title}`
        });

    } catch (err) {
        console.error('[PLAY] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '*❌ Error Occurred*'
        }, { quoted: message });
    }

}

module.exports = playCommand
