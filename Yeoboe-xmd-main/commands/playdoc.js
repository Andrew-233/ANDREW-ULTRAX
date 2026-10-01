




async function playdocCommand(sock, chatId, message) {
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

        let audioDoc;
        let title = query;

        // Supreme API is the primary audio downloader.
        try {
            const supremeResponse = await axios.get(
                `https://apissupreme.vercel.app/media/play?apikey=supreme&query=${encodeURIComponent(query)}`,
                { timeout: 60000 }
            );
            if (supremeResponse.data?.status && supremeResponse.data?.downloadUrl) {
                audioDoc = supremeResponse.data.downloadUrl;
                title = supremeResponse.data.title || title;
            }
        } catch (primaryError) {
            console.warn('Supreme audio API failed for playdoc command:', primaryError.message);
        }

        if (!audioDoc) {
            console.log('[PLAY] Searching YT for:', query);
            const search = await yts(query);
            const video = search.videos[0];
            if (!video) {
                return await sock.sendMessage(chatId, {
                    text: '*❌ No Results Found*\nNo songs found for your query. Please try different keywords.*'
                }, { quoted: message });
            }
            title = video.title;
            const apiURL = `${BASE_URL}/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp3`;
            const response = await axios.get(apiURL, { timeout: 30000 });
            audioDoc = response.data?.downloadLink;
        }

        if (!audioDoc) {
            return await sock.sendMessage(chatId, {
                text: '*❌ Download Failed*\nFailed to retrieve the MP3 download link. Please try again later.*'
            }, { quoted: message});
        }

        const fileName = `${title.replace(/[\\/:*?"<>|]/g, '')}.mp3`;

        // Send audio file
        await sock.sendMessage(chatId, {
            document: { url: audioDoc },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            caption: ``},{ quoted: message
        });

    } catch (err) {
        console.error('[PLAY] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '*❌ Error Occurred*'
        }, { quoted: message });
    }

}

module.exports = playdocCommand
