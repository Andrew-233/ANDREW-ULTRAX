const axios = require('axios');
const { createFakeContact } = require('../lib/fakeContact');
const { SORA_APIS: SORA_API_BASES } = require('../lib/apiConfig');

// Build caller functions from the base URLs in apiConfig
// apiConfig.SORA_APIS = [
//   "https://api.siputzx.my.id/api/ai/sora",       -- ?text=...
//   "https://apiskeith.top/ai/txt2video",           -- ?text=... (placeholder)
//   "https://api.vreden.my.id/api/ai/sora",         -- ?prompt=...
// ]
const HEADERS = { 'user-agent': 'Mozilla/5.0' };
const TIMEOUT = 90000;

const API_CALLERS = [
    // 1. siputzx  — ?text=prompt
    async (prompt) => {
        const url = `${SORA_API_BASES[0]}?text=${encodeURIComponent(prompt)}`;
        const { data } = await axios.get(url, { timeout: TIMEOUT, headers: HEADERS });
        return data?.data?.video || data?.videoUrl || data?.url || data?.result || null;
    },
    // 2. apiskeith placeholder  — ?text=prompt  (becomes live once Keith adds the route)
    async (prompt) => {
        const base = SORA_API_BASES[1];
        if (!base || base.includes('placeholder')) return null;
        const url = `${base}?text=${encodeURIComponent(prompt)}`;
        const { data } = await axios.get(url, { timeout: TIMEOUT, headers: HEADERS });
        return data?.videoUrl || data?.result || data?.data?.videoUrl || data?.data?.url || null;
    },
    // 3. vreden  — ?prompt=prompt
    async (prompt) => {
        const url = `${SORA_API_BASES[2]}?prompt=${encodeURIComponent(prompt)}`;
        const { data } = await axios.get(url, { timeout: TIMEOUT, headers: HEADERS });
        return data?.result?.video || data?.videoUrl || data?.url || data?.result || null;
    },
];

async function soraCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    try {
        const rawText =
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() || '';

        const used = rawText.split(/\s+/)[0] || '.sora';
        const args = rawText.slice(used.length).trim();
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        const input = args || quotedText;

        if (!input) {
            await sock.sendMessage(chatId, {
                text: `🎬 *SORA VIDEO GENERATOR*\n\n` +
                      `Generate AI videos from text prompts.\n\n` +
                      `*Usage:* \`.sora anime girl with blue hair in cherry blossom forest\`\n\n` +
                      `_Generation takes 30–90 seconds, please wait..._`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `🎬 Generating video for: *${input}*\n\n_This may take up to 90 seconds..._`
        }, { quoted: fake });

        let videoUrl = null;
        let lastError = null;

        for (const callApi of API_CALLERS) {
            try {
                const result = await callApi(input);
                if (result && typeof result === 'string' && result.startsWith('http')) {
                    videoUrl = result;
                    break;
                }
            } catch (err) {
                lastError = err;
                console.error('[SORA] API attempt failed:', err?.message);
            }
        }

        if (!videoUrl) {
            throw new Error(lastError?.message || 'All video generation APIs returned no URL');
        }

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: `🎬 *Sora AI Video*\n📝 Prompt: ${input}`
        }, { quoted: fake });

    } catch (error) {
        console.error('[SORA] Error:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to generate video.\n\n_The AI video service may be temporarily unavailable. Try again later._`
        }, { quoted: fake });
    }
}

module.exports = soraCommand;
