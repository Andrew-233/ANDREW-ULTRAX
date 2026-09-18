const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function spotifyCommand(sock, chatId, message) {
    try {
        const quoted = createFakeContact(message);

        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎵', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';

        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n❌ Please provide a song name or Spotify URL!\n\n📝 *Usage:*\n.spotify Blinding Lights\nThe Weeknd\n.spot https://open.spotify.com/track/...\n.spdl Shape of You Ed Sheeran\n\n🔍 *Examples:*\n• .spotify Bohemian Rhapsody\n• .spot Yesterday The Beatles\n• .spotify https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b\n\n💡 *Supported:*\n• Song names\n• Artist + Song\n• Spotify URLs\n• Playlist URLs (first track)'
            }, { quoted });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n❌ Please provide a song name or Spotify URL!\n\n📝 *Example:*\n.spotify Dance Monkey'
            }, { quoted });
        }

        if (query.length > 200) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n📝 Query too long! Max 200 characters.\n\n💡 Try a shorter song name.'
            }, { quoted });
        }

        // Presence update
        await sock.sendPresenceUpdate('recording', chatId);

        // API call
        const apiUrl = `https://www.apiskeith.top/download/spotify?url=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });

        const apiData = response.data;
        if (!apiData?.status || !apiData?.result) throw new Error('No download link found');

        const dl = apiData.result;
        const fileName = `${query.replace(/[^a-z0-9]/gi, '_')}.mp3`;

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Send audio with fake contact quoted
        await sock.sendMessage(chatId, {
            audio: { url: dl },
            mimetype: 'audio/mpeg',
            fileName
        }, { quoted });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎧', key: message.key }
        });

    } catch (error) {
        const quoted = createFakeContact(message);
        console.error(`Spotify command error for query "${message.message?.conversation || ''}":`, error);

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) errorMessage = 'Spotify API endpoint not found!';
        else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') errorMessage = 'Download timed out! The song might be too long.';
        else if (error.code === 'ENOTFOUND') errorMessage = 'Cannot connect to Spotify service!';
        else if (error.response?.status === 429) errorMessage = 'Too many download requests! Please wait a while.';
        else if (error.response?.status === 403) errorMessage = 'Spotify download service is temporarily blocked!';
        else if (error.response?.status >= 500) errorMessage = 'Spotify service is currently unavailable.';
        else if (error.message.includes('No download link') || error.message.includes('Invalid track')) errorMessage = 'Song not found or cannot be downloaded!';
        else if (error.message.includes('premium')) errorMessage = 'This may be a premium-only track!';
        else if (error.message.includes('region') || error.message.includes('not available')) errorMessage = 'This track is not available in your region!';
        else errorMessage = `Error: ${error.message}`;

        await sock.sendMessage(chatId, {
            text: `🎵 *Spotify Music Downloader*\n\n🚫 ${errorMessage}\n\n *Tips:*\n• Try a different song\n• Check the spelling\n• Try without special characters\n• Use exact song title\n• Wait a few minutes and try again\n\n🔗 *Alternative:* Use .ytmp3 for YouTube downloads`
        }, { quoted });
    }
}

module.exports = spotifyCommand;
