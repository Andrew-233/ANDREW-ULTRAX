const BASE_API = "https://apiskeith.top";

// ── Anime API configuration ──────────────────────────────────────────────────
// Primary: nekos.best  — free, no auth, very reliable
//   GIF reactions : GET /api/v2/{type}  → { results: [{ url, anime_name }] }
//   SFW images    : GET /api/v2/{type}  → { results: [{ url, artist_name }] }
const ANIME_API = "https://nekos.best/api/v2";

// Fallback image source (waifu.pics) — also free, no auth
//   GET /api/sfw/{type}  → { url: "..." }
const ANIME_API_FALLBACK = "https://api.waifu.pics";

// Anime quote source
//   GET /api/v1/quotes/random  → { data: { content, character: {name}, anime: {name} } }
const ANIME_QUOTE_API = "https://animechan.io";

// ── Sora (text-to-video) API configuration ───────────────────────────────────
const SORA_APIS = [
    `https://api.siputzx.my.id/api/ai/sora`,      // ?text=...
    `${BASE_API}/ai/txt2video`,                    // placeholder — add when live
    `https://api.vreden.my.id/api/ai/sora`,        // ?prompt=...
];

module.exports = {
    BASE_API,
    ANIME_API,
    ANIME_API_FALLBACK,
    ANIME_QUOTE_API,
    SORA_APIS,
};
