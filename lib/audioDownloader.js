const axios = require('axios');
const yts = require('yt-search');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_THUMBNAIL = 'https://img.youtube.com/vi/default/hqdefault.jpg';
const API_TIMEOUT = 15000;

function extractYouTubeId(input) {
    try {
        const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
        const url = new URL(value);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        let id = null;

        if (host === 'youtu.be') {
            id = url.pathname.split('/').filter(Boolean)[0];
        } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            id = url.searchParams.get('v');
            if (!id) {
                id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] || null;
            }
        }

        return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch {
        return null;
    }
}

function isYouTubeLink(input) {
    return /(?:youtu\.be|youtube\.com)/i.test(input);
}

async function resolveVideo(input) {
    const videoId = extractYouTubeId(input);

    if (videoId) {
        // Preserve a supplied short URL and its query parameters: the provided
        // downloader has been confirmed to accept this exact link format.
        const requestUrl = /^https?:\/\//i.test(input) ? input : `https://${input}`;
        try {
            const search = await yts({ videoId });
            const video = search?.videos?.find(item => item.videoId === videoId) || search?.videos?.[0];
            return {
                videoUrl: requestUrl,
                videoId,
                title: video?.title || videoId,
                thumbnail: video?.thumbnail || DEFAULT_THUMBNAIL,
                duration: video?.timestamp || '0:00',
                video
            };
        } catch {
            return {
                videoUrl: requestUrl,
                videoId,
                title: videoId,
                thumbnail: DEFAULT_THUMBNAIL,
                duration: '0:00',
                video: null
            };
        }
    }

    if (isYouTubeLink(input)) {
        throw new Error('That YouTube link is invalid. Use a watch, youtu.be, shorts, or live link.');
    }

    const search = await yts(input);
    const video = search?.videos?.[0];
    if (!video?.url) throw new Error('No YouTube results found for that search.');

    return {
        videoUrl: video.url,
        videoId: video.videoId || extractYouTubeId(video.url),
        title: video.title || input,
        thumbnail: video.thumbnail || DEFAULT_THUMBNAIL,
        duration: video.timestamp || '0:00',
        video
    };
}

function findDownloadUrl(value, depth = 0) {
    if (depth > 5 || value == null) return null;

    if (typeof value === 'string') {
        const candidate = value.trim();
        try {
            const parsed = new URL(candidate);
            return parsed.protocol === 'https:' ? candidate : null;
        } catch {
            return null;
        }
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findDownloadUrl(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    if (typeof value !== 'object') return null;

    const preferredKeys = [
        'downloadUrl', 'download_url', 'downloadLink', 'download_link',
        'audioUrl', 'audio_url', 'mp3', 'url', 'link'
    ];
    for (const key of preferredKeys) {
        if (value[key]) {
            const found = findDownloadUrl(value[key], depth + 1);
            if (found) return found;
        }
    }

    for (const key of ['result', 'data', 'audio', 'media', 'file', 'links']) {
        if (value[key]) {
            const found = findDownloadUrl(value[key], depth + 1);
            if (found) return found;
        }
    }

    return null;
}

function firstString(values) {
    return values.find(value => typeof value === 'string' && value.trim())?.trim();
}

function getResponseTitle(data, fallback) {
    return firstString([
        data?.title,
        data?.result?.title,
        data?.data?.title,
        data?.result?.data?.title,
        data?.result?.video?.title
    ]) || fallback;
}

async function requestAudioApi(videoUrl) {
    const response = await axios.get('https://apissupreme.vercel.app/media/ytmp3', {
        params: { apikey: 'supreme', url: videoUrl },
        timeout: API_TIMEOUT,
        headers: { Accept: 'application/json' }
    });
    const download = findDownloadUrl(response.data);

    if (response.data?.status === false || response.data?.success === false || !download) {
        throw new Error(response.data?.error || 'The audio API did not return a download link.');
    }

    return { download, title: getResponseTitle(response.data, '') };
}

async function requestFallbackApi(videoUrl, videoId) {
    const fallbacks = [
        {
            name: 'Noobs API',
            url: 'https://noobs-api.top/dipto/ytDl3',
            params: { link: videoId || videoUrl, format: 'mp3' }
        },
        {
            name: 'Gifted API',
            url: 'https://api.giftedtech.co.ke/api/download/ytmp3',
            params: { apikey: 'gifted', url: videoUrl }
        }
    ];

    for (const provider of fallbacks) {
        try {
            const response = await axios.get(provider.url, {
                params: provider.params,
                timeout: API_TIMEOUT,
                headers: { Accept: 'application/json' }
            });
            const download = findDownloadUrl(response.data);
            if (download && response.data?.status !== false && response.data?.success !== false) {
                return { download, title: getResponseTitle(response.data, '') };
            }
        } catch (error) {
            console.warn(`${provider.name} audio fallback failed:`, error.message);
        }
    }

    return null;
}

async function requestLocalAudio(videoUrl, title, thumbnail, duration, video) {
    const ytdl = require('ytdl-core');
    const ffmpegPath = require('ffmpeg-static');
    if (!ffmpegPath) throw new Error('The local audio converter is unavailable.');

    const filePath = path.join(os.tmpdir(), `issah-audio-${crypto.randomUUID()}.mp3`);
    const child = spawn(ffmpegPath, [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vn',
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        '-f', 'mp3',
        '-y',
        filePath
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    const source = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
    let stderr = '';

    try {
        await new Promise((resolve, reject) => {
            child.stderr.on('data', chunk => {
                if (stderr.length < 4000) stderr += chunk.toString();
            });
            child.once('error', error => {
                source.destroy();
                reject(error);
            });
            child.once('close', code => {
                if (code === 0) resolve();
                else {
                    source.destroy();
                    reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
                }
            });
            source.once('error', error => {
                child.kill();
                reject(error);
            });
            child.stdin.once('error', error => {
                if (error.code !== 'EPIPE') reject(error);
            });
            source.pipe(child.stdin);
        });

        const stat = await fs.promises.stat(filePath);
        if (!stat.size) throw new Error('The converted audio file is empty.');
        return {
            download: filePath,
            localPath: filePath,
            title,
            thumbnail,
            duration,
            source: videoUrl,
            video
        };
    } catch (error) {
        await fs.promises.unlink(filePath).catch(() => {});
        throw error;
    }
}

async function downloadYouTubeAudio(input) {
    const resolved = await resolveVideo(input.trim());
    let result;

    try {
        result = await requestAudioApi(resolved.videoUrl);
    } catch (error) {
        console.warn('Supreme YouTube audio API failed:', error.message);
    }

    if (!result) {
        result = await requestFallbackApi(resolved.videoUrl, resolved.videoId);
    }

    if (result) {
        return {
            ...resolved,
            ...result,
            title: result.title || resolved.title,
            source: resolved.videoUrl
        };
    }

    return requestLocalAudio(
        resolved.videoUrl,
        resolved.title,
        resolved.thumbnail,
        resolved.duration,
        resolved.video
    );
}

async function cleanupAudio(audio) {
    if (audio?.localPath) {
        await fs.promises.unlink(audio.localPath).catch(() => {});
    }
}

module.exports = { downloadYouTubeAudio, cleanupAudio };
