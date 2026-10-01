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

        let audioUrl;
        let title = query;
        let thumbnail;
        let video;

        // Supreme API is the primary audio downloader.
        try {
            const supremeResponse = await axios.get(
                `https://apissupreme.vercel.app/media/play?apikey=supreme&query=${encodeURIComponent(query)}`,
                { timeout: 60000 }
            );
            if (supremeResponse.data?.status && supremeResponse.data?.downloadUrl) {
                audioUrl = supremeResponse.data.downloadUrl;
                title = supremeResponse.data.title || title;
                thumbnail = supremeResponse.data.thumbnail;
            }
        } catch (primaryError) {
            console.warn('Supreme audio API failed for pla command:', primaryError.message);
        }

        if (!audioUrl) {
            console.log('[PLAY] Searching YT for:', query);
            const search = await yts(query);
            video = search.videos[0];
            if (!video) {
                return await sock.sendMessage(chatId, {
                    text: '*❌ No Results Found*\nNo songs found for your query. Please try different keywords.*'
                }, { quoted: message });
            }
            title = video.title;
            thumbnail = video.thumbnail;
            const apiURL = `${BASE_URL}/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp3`;
            const response = await axios.get(apiURL, { timeout: 30000 });
            audioUrl = response.data?.downloadLink;
        }

        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '');
        const fileName = `${safeTitle}.mp3`;

        // Create single button for getting video
        const buttonMessage = video ? {
            image: { url: thumbnail },
            caption: `
🎵 *NOW PLAYING* 🎵

🎶 *Title:* ${title}
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
                    buttonId: '.video ' + title,
                    buttonText: { displayText: '🎬 Get Video' },
                    type: 1
                }
            ],
            headerType: 1
        } : {
            text: `🎵 *NOW PLAYING*\n\n🎶 *Title:* ${title}\n\n⬇️ *Downloading your audio...*`
        };

        // Send song description with thumbnail and single button
        await sock.sendMessage(chatId, buttonMessage, { quoted: message });

        if (!audioUrl) {
            return await sock.sendMessage(chatId, {
                text: '*❌ Download Failed*\nFailed to retrieve the MP3 download link. Please try again later.*'
            }, { quoted: message});
        }

        // Send audio file
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            caption: `✅ *Download Complete!*\n🎵 ${title}`
        });

    } catch (err) {
        console.error('[PLAY] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '*❌ Error Occurred*'
        }, { quoted: message });
    }

}

module.exports = playCommand
