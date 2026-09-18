const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: '🔍 Please enter the song name to get the lyrics! Usage: lyrics <song name>'
        }, { quoted: createFakeContact(message) });
        return;
    }

    try {
        const res = await axios.get(`https://apiskeith.top/search/lyrics2?query=${encodeURIComponent(songTitle)}`);
        const data = res.data;

        if (!data.status || !data.result) {
            await sock.sendMessage(chatId, { text: "💢 Not found" }, { quoted: createFakeContact(message) });
            return;
        }

        const caption = `🎶 ${data.result}`;

        await sock.sendMessage(chatId, { text: caption }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in lyrics command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = { lyricsCommand };
