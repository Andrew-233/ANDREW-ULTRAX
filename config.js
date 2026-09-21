require('dotenv').config();

/**
 * API endpoints are static; keys come from the environment first.
 *
 * Previously every key was hardcoded in tracked source (and `.gitignore` was inert, so
 * there was no barrier to publishing them). The literal fallbacks below keep an existing
 * install working, but for anything you deploy publicly set XTEAM_KEY / LOLHUMAN_KEY /
 * GIPHY_API_KEY in .env and rotate the values - they have been committed and must be
 * considered burned.
 */
global.APIs = {
    xteam: 'https://api.xteam.xyz',
    dzx: 'https://api.dhamzxploit.my.id',
    lol: 'https://api.lolhuman.xyz',
    violetics: 'https://violetics.pw',
    neoxr: 'https://api.neoxr.my.id',
    zenzapis: 'https://zenzapis.xyz',
    akuari: 'https://api.akuari.my.id',
    akuari2: 'https://apimu.my.id',
    nrtm: 'https://fg-nrtm.ddns.net',
    bg: 'http://bochil.ddns.net',
    fgmods: 'https://api-fgmods.ddns.net'
};

global.APIKeys = {
    'https://api.xteam.xyz': process.env.XTEAM_KEY || 'd90a9e986e18778b',
    'https://api.lolhuman.xyz': process.env.LOLHUMAN_KEY || '85faf717d0545d14074659ad',
    'https://api.neoxr.my.id': process.env.NEOXR_KEY || 'yourkey',
    'https://violetics.pw': process.env.VIOLETICS_KEY || 'beta',
    'https://zenzapis.xyz': process.env.ZENZAPIS_KEY || 'yourkey',
    'https://api-fgmods.ddns.net': process.env.FGMODS_KEY || 'fg-dylux'
};

module.exports = {
    SESSION_ID: global.SESSION_ID || process.env.SESSION_ID,
    WARN_COUNT: Number(process.env.WARN_COUNT) || 3,
    APIs: global.APIs,
    APIKeys: global.APIKeys
};
