const { createFakeContact } = require('../lib/fakeContact');
const { downloadYouTubeAudio, cleanupAudio } = require('../lib/audioDownloader');

async function songCommand(sock, chatId, message) {
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
            react: { text: '🎶', key: message.key }
        });

        audio = await downloadYouTubeAudio(query);
        const safeTitle = audio.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 100) || 'YouTube Audio';
        await sock.sendMessage(chatId, {
            text: `_Playing 🎵_\n_${audio.title} 🎶_`
        }, { quoted });

        await sock.sendMessage(chatId, {
            audio: { url: audio.download },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            caption: `🎵 *${audio.title}*`
        }, { quoted });

        await sock.sendMessage(chatId, {
            document: { url: audio.download },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            caption: `🎵 *${audio.title}*`
        }, { quoted });
    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, {
            text: `Download failed: ${error.message || 'Please try again later.'}`
        }, { quoted });
    } finally {
        await cleanupAudio(audio);
    }
}

module.exports = songCommand;
