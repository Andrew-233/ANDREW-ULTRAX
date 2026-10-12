const { createFakeContact } = require('../lib/fakeContact');`
async function playCommand(sock, chatId, message) {
    const quoted = createFakeContact(message);
    let audio;

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.trim().split(/\s+/).slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: 'What song do you want to download?'
            }, { quoted });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });

        audio = await downloadYouTubeAudio(query);
        await sock.sendMessage(chatId, {
            text: `_Downloading 🎵_\n_${audio.title} 🎶_`
        }, { quoted });

        const safeTitle = audio.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 100) || 'YouTube Audio';
        await sock.sendMessage(chatId, {
            document: { url: audio.download },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            caption: `🎵 *${audio.title}*`
        }, { quoted });
    } catch (error) {
        console.error('Error in playCommand:', error);
        await sock.sendMessage(chatId, {
            text: `Download failed: ${error.message || 'Please try again later.'}`
        }, { quoted });
    } finally {
        await cleanupAudio(audio);
    }
}

module.exports = playCommand;
