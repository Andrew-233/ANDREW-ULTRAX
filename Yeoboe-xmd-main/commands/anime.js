const axios = require('axios');
const { createFakeContact } = require('../lib/fakeContact');
const { ANIME_API, ANIME_API_FALLBACK, ANIME_QUOTE_API } = require('../lib/apiConfig');

// ── Supported types ──────────────────────────────────────────────────────────
// GIF reactions served by nekos.best
const GIF_TYPES = [
    'hug', 'kiss', 'pat', 'poke', 'cry', 'wink', 'nom', 'pout',
    'bite', 'blush', 'bored', 'cuddle', 'dance', 'facepalm', 'feed',
    'handhold', 'happy', 'highfive', 'kick', 'laugh', 'nod', 'nope',
    'punch', 'run', 'sad', 'shoot', 'shrug', 'sip', 'slap', 'sleep',
    'smile', 'smug', 'stare', 'think', 'thumbsup', 'tickle', 'wag',
    'wave', 'yawn', 'yeet'
];

// Static images served by nekos.best (fallback: waifu.pics)
const IMAGE_TYPES = ['neko', 'waifu', 'husbando', 'kitsune'];

const ALL_TYPES = [...GIF_TYPES, ...IMAGE_TYPES, 'quote', 'loli'];

// ── Alias normaliser ─────────────────────────────────────────────────────────
function normalizeType(input) {
    const lower = (input || '').toLowerCase().trim();
    const aliases = {
        'face-palm':   'facepalm',
        'face_palm':   'facepalm',
        'nome':        'nom',
        'animuquote':  'quote',
        'animu-quote': 'quote',
        'animequote':  'quote',
        'loli':        'neko',   // loli → neko (SFW)
        'cutte':       'cuddle',
    };
    return aliases[lower] || lower;
}

// ── nekos.best fetcher ───────────────────────────────────────────────────────
// ANIME_API = "https://nekos.best/api/v2"
async function fetchNEKOSBest(type) {
    const url = `${ANIME_API}/${type}`;
    const res = await axios.get(url, { timeout: 15000 });
    const result = res.data?.results?.[0];
    if (!result?.url) throw new Error(`nekos.best: no URL for type '${type}'`);
    return result;
}

// ── waifu.pics fallback ──────────────────────────────────────────────────────
// ANIME_API_FALLBACK = "https://api.waifu.pics"
// Maps our type names to waifu.pics SFW categories
const WAIFU_PICS_MAP = {
    waifu:    'waifu',
    neko:     'neko',
    husbando: 'husbando',
    kitsune:  'shinobu',   // closest match
    hug:      'hug',
    kiss:     'kiss',
    pat:      'pat',
    blush:    'blush',
    cry:      'cry',
    poke:     'poke',
    slap:     'slap',
    smug:     'smug',
    cuddle:   'cuddle',
    dance:    'dance',
    happy:    'happy',
    wave:     'wave',
    nom:      'nom',
    bite:     'bite',
    handhold: 'handhold',
    kick:     'kick',
    wink:     'wink',
    pout:     'pout',
    sleep:    'sleep',
    shrug:    'shrug',
};

async function fetchWaifuPics(type) {
    const category = WAIFU_PICS_MAP[type] || type;
    const url = `${ANIME_API_FALLBACK}/api/sfw/${category}`;
    const res = await axios.get(url, { timeout: 12000 });
    if (!res.data?.url) throw new Error(`waifu.pics: no URL for '${category}'`);
    return { url: res.data.url };
}

// ── Quote fetcher ────────────────────────────────────────────────────────────
// ANIME_QUOTE_API = "https://animechan.io"
async function fetchQuote() {
    // Primary: animechan
    try {
        const res = await axios.get(`${ANIME_QUOTE_API}/api/v1/quotes/random`, { timeout: 10000 });
        const d = res.data?.data;
        if (d?.content) {
            return `"${d.content}"\n\n— ${d.character?.name || 'Unknown'} (${d.anime?.name || 'Anime'})`;
        }
    } catch (_) {}
    // Fallback: nekos.best quote endpoint
    try {
        const res = await axios.get(`${ANIME_API}/quote`, { timeout: 10000 });
        const r = res.data?.results?.[0];
        if (r?.quote) return `"${r.quote}"\n\n— ${r.character || 'Unknown'} (${r.anime || 'Anime'})`;
    } catch (_) {}
    throw new Error('Could not fetch an anime quote right now.');
}

// ── Core media sender ────────────────────────────────────────────────────────
async function sendAnimu(sock, chatId, message, type) {
    const fake = createFakeContact(message);
    const isImageType = IMAGE_TYPES.includes(type);

    try {
        let result;
        let usedFallback = false;

        try {
            result = await fetchNEKOSBest(type);
        } catch (primaryErr) {
            console.warn(`[anime] nekos.best failed for '${type}': ${primaryErr.message} — trying fallback`);
            try {
                result = await fetchWaifuPics(type);
                usedFallback = true;
            } catch (fallbackErr) {
                throw new Error(`All APIs failed for '${type}'. Last error: ${fallbackErr.message}`);
            }
        }

        const mediaUrl = result.url;
        const animeSource = result.anime_name ? ` (${result.anime_name})` : '';
        const caption = `🎌 ${type}${animeSource}`;

        if (isImageType) {
            await sock.sendMessage(chatId,
                { image: { url: mediaUrl }, caption },
                { quoted: fake }
            );
        } else {
            // Send GIF as looping video so WhatsApp animates it
            await sock.sendMessage(chatId,
                { video: { url: mediaUrl }, caption, gifPlayback: true },
                { quoted: fake }
            );
        }
    } catch (err) {
        console.error(`[anime] Error for '${type}':`, err.message);
        await sock.sendMessage(chatId,
            { text: `❌ Failed to fetch *${type}*. The service may be down — try again later.` },
            { quoted: fake }
        );
    }
}

// ── Main command handler ──────────────────────────────────────────────────────
async function animeCommand(sock, chatId, message, args) {
    const fake = createFakeContact(message);
    const subArg = args && args[0] ? args[0] : '';
    const sub = normalizeType(subArg);

    if (!sub) {
        const gifSample = GIF_TYPES.slice(0, 14).join(', ');
        const imgList = IMAGE_TYPES.join(', ');
        await sock.sendMessage(chatId, {
            text: `🎌 *ANIME COMMANDS*\n\n` +
                  `*Reactions (GIF):*\n${gifSample}, ...\n\n` +
                  `*Images:* ${imgList}\n\n` +
                  `*Other:* quote\n\n` +
                  `*Usage:* \`.animu hug\` or shortcut \`.hug\`, \`.kiss\`, \`.pat\`, \`.cry\`, \`.waifu\`, etc.`
        }, { quoted: fake });
        return;
    }

    if (sub === 'quote') {
        try {
            const text = await fetchQuote();
            await sock.sendMessage(chatId, { text }, { quoted: fake });
        } catch (err) {
            await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: fake });
        }
        return;
    }

    if (!ALL_TYPES.includes(sub)) {
        await sock.sendMessage(chatId, {
            text: `❌ Unknown type: *${sub}*\n\n` +
                  `Try: ${[...GIF_TYPES.slice(0, 10), ...IMAGE_TYPES, 'quote'].join(', ')}...`
        }, { quoted: fake });
        return;
    }

    await sendAnimu(sock, chatId, message, sub);
}

module.exports = { animeCommand };
