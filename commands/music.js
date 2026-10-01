const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

/* =========================
   SAFE REQUEST WITH RETRY
========================= */
async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) {
                await new Promise(r => setTimeout(r, i * 1000));
            }
        }
    }
    throw lastError;
}

/* =========================
   KEITH AUDIO DOWNLOADER
   (ALL RESPONSE TYPES)
========================= */
async function getKeithDownload(youtubeUrl) {
    const apiUrl = `https://apiskeith.top/download/audio?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));

    if (!res?.data?.status) {
        throw new Error('Keith API status false');
    }

    const result = res.data.result;

    // Case 1: direct URL string
    if (typeof result === 'string') {
        return {
            download: result,
            title: 'YouTube Audio',
            thumbnail: 'https://img.youtube.com/vi/default/hqdefault.jpg',
            duration: '0:00'
        };
    }

    // Case 2: object with url
    if (result?.url) {
        return {
            download: result.url,
            title: result.title || 'YouTube Audio',
            thumbnail: result.thumbnail || 'https://img.youtube.com/vi/default/hqdefault.jpg',
            duration: result.duration || '0:00'
        };
    }

    throw new Error('Keith API returned unknown format');
}

async function getSupremeDownload(query) {
    const apiUrl = `https://apissupreme.vercel.app/media/play?apikey=supreme&query=${encodeURIComponent(query)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (!res?.data?.status || !res.data.downloadUrl) {
        throw new Error('Supreme API did not return a download URL');
    }
    return {
        download: res.data.downloadUrl,
        title: res.data.title || query,
        thumbnail: res.data.thumbnail || 'https://img.youtube.com/vi/default/hqdefault.jpg',
        duration: res.data.duration || '0:00',
        source: res.data.source || query
    };
}

/* =========================
   SONG COMMAND
========================= */
async function songCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text) {
            return sock.sendMessage(
                chatId,
                { text: 'Usage: .song <song name or YouTube link>' },
                { quoted: message }
            );
        }

        let video = {
            url: text,
            title: text,
            thumbnail: 'https://img.youtube.com/vi/default/hqdefault.jpg',
            timestamp: '0:00'
        };
        let audio;

        // Supreme API is the primary audio downloader.
        try {
            audio = await getSupremeDownload(text);
        } catch (primaryError) {
            console.warn('Supreme audio API failed for music command:', primaryError.message);
        }

        if (!audio) {
            // Existing search/provider remains as the fallback.
            if (text.includes('youtube.com') || text.includes('youtu.be')) {
                const search = await yts(text);
                video = search?.videos?.[0] || video;
            } else {
                const search = await yts(text);
                if (!search?.videos?.length) {
                    return sock.sendMessage(
                        chatId,
                        { text: '❌ No results found.' },
                        { quoted: message }
                    );
                }
                video = search.videos[0];
            }
            audio = await getKeithDownload(video.url);
        }

        // Send downloading message
        await sock.sendMessage(
            chatId,
            {
                text: `🎵 *Downloading Audio...*\n\n*Title:* ${audio.title || video.title}\n*Duration:* ${audio.duration || video.timestamp || '0:00'}`
            },
            { quoted: message }
        );

        if (!audio?.download) {
            throw new Error('Download URL not found');
        }

        // SEND AUDIO (FIXED)
        await sock.sendMessage(
    chatId,
    {
        document: { url: audio.download },
        mimetype: "audio/mpeg",
        fileName: `${(audio.title || video.title).substring(0, 100)}.mp3`,
        contextInfo: {
            externalAdReply: {
                title: audio.title || video.title,
                body: 'YouTube Audio Download',
                mediaType: 2,
                thumbnailUrl: video.thumbnail,
                mediaUrl: audio.source || video.url,
                sourceUrl: audio.source || video.url,
                showAdAttribution: true
            }
        }
    },
    { quoted: message }
);
    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(
            chatId,
            { text: `❌ Failed to download song:\n${err.message}` },
            { quoted: message }
        );
    }

}

module.exports = songCommand;
