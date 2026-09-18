const { getConfig, updateConfig } = require('./botConfig');

function buildMap(upperBase, lowerBase, digitBase, upperExceptions = {}, lowerExceptions = {}) {
    const map = {};
    for (let i = 0; i < 26; i++) {
        const upper = String.fromCharCode(65 + i);
        const lower = String.fromCharCode(97 + i);
        map[upper] = upperExceptions[i] !== undefined
            ? String.fromCodePoint(upperExceptions[i])
            : String.fromCodePoint(upperBase + i);
        map[lower] = lowerExceptions[i] !== undefined
            ? String.fromCodePoint(lowerExceptions[i])
            : String.fromCodePoint(lowerBase + i);
    }
    if (digitBase !== null) {
        for (let i = 0; i < 10; i++) {
            map[String.fromCharCode(48 + i)] = String.fromCodePoint(digitBase + i);
        }
    }
    return map;
}

// Small caps codepoints (non-contiguous — built manually)
const SMALL_CAPS_CHARS = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ';

function buildSmallCaps() {
    const m = {};
    for (let i = 0; i < 26; i++) {
        const sc = SMALL_CAPS_CHARS[i];
        m[String.fromCharCode(65 + i)] = sc;
        m[String.fromCharCode(97 + i)] = sc;
    }
    return m;
}

// Circled digits: ⓪=U+24EA, ①-⑨=U+2460-U+2468
function buildCircled() {
    const m = buildMap(0x24B6, 0x24D0, null);
    m['0'] = '\u24EA';
    for (let i = 1; i <= 9; i++) m[String.fromCharCode(48 + i)] = String.fromCodePoint(0x2460 + i - 1);
    return m;
}

// Parenthesized: ⒜-⒵ (U+249C-U+24B5, lowercase only)
// Uppercase letters map to their parenthesized lowercase equivalent
function buildParenthesized() {
    const m = {};
    for (let i = 0; i < 26; i++) {
        const ch = String.fromCodePoint(0x249C + i);
        m[String.fromCharCode(65 + i)] = ch;
        m[String.fromCharCode(97 + i)] = ch;
    }
    return m;
}

const FONT_MAPS = {
    // ── Math / Typography ──────────────────────────────────
    bold: buildMap(0x1D400, 0x1D41A, 0x1D7CE),
    italic: buildMap(
        0x1D434, 0x1D44E, null,
        {},
        { 4: 0x212F, 7: 0x210E }
    ),
    bold_italic: buildMap(0x1D468, 0x1D482, null),
    script: buildMap(
        0x1D49C, 0x1D4B6, null,
        { 1: 0x212C, 4: 0x2130, 5: 0x2131, 7: 0x210B, 8: 0x2110, 11: 0x2112, 12: 0x2133, 17: 0x211B },
        { 4: 0x212F, 6: 0x210A, 14: 0x2134 }
    ),
    bold_script: buildMap(0x1D4D0, 0x1D4EA, null),
    fraktur: buildMap(
        0x1D504, 0x1D51E, null,
        { 2: 0x212D, 7: 0x210C, 8: 0x2111, 17: 0x211C, 25: 0x2128 },
        {}
    ),
    bold_fraktur: buildMap(0x1D56C, 0x1D586, null),
    double_struck: buildMap(
        0x1D538, 0x1D552, 0x1D7D8,
        { 2: 0x2102, 7: 0x210D, 13: 0x2115, 15: 0x2119, 16: 0x211A, 17: 0x211D, 25: 0x2124 },
        {}
    ),
    // ── Sans ───────────────────────────────────────────────
    sans: buildMap(0x1D5A0, 0x1D5BA, 0x1D7E2),
    sans_bold: buildMap(0x1D5D4, 0x1D5EE, 0x1D7EC),
    sans_italic: buildMap(0x1D608, 0x1D622, null),
    sans_bold_italic: buildMap(0x1D63C, 0x1D656, null),
    monospace: buildMap(0x1D670, 0x1D68A, 0x1D7F6),
    // ── Decorative ─────────────────────────────────────────
    fullwidth: buildMap(0xFF21, 0xFF41, 0xFF10),
    small_caps: buildSmallCaps(),
    circled: buildCircled(),
    neg_circled: buildMap(0x1F150, 0x1F150, null),
    squared: buildMap(0x1F130, 0x1F130, null),
    parenthesized: buildParenthesized(),
};

const FONT_LABELS = {
    // Math / Typography
    bold: 'Bold',
    italic: 'Italic',
    bold_italic: 'Bold Italic',
    script: 'Script',
    bold_script: 'Bold Script',
    fraktur: 'Fraktur',
    bold_fraktur: 'Bold Fraktur',
    double_struck: 'Double Struck',
    // Sans
    sans: 'Sans Serif',
    sans_bold: 'Sans Bold',
    sans_italic: 'Sans Italic',
    sans_bold_italic: 'Sans Bold Italic',
    monospace: 'Monospace',
    // Decorative
    fullwidth: 'Fullwidth',
    small_caps: 'Small Caps',
    circled: 'Circled',
    neg_circled: 'Bubble (Filled Circle)',
    squared: 'Squared',
    parenthesized: 'Parenthesized',
};

function applyFont(text) {
    const style = getConfig().autoFont;
    if (!style || style === 'off' || style === 'normal' || !FONT_MAPS[style]) return text;
    const map = FONT_MAPS[style];
    return [...text].map(ch => map[ch] || ch).join('');
}

function getFontStyle() {
    return getConfig().autoFont || 'off';
}

function setFontStyle(style) {
    updateConfig({ autoFont: style });
}

function listFonts() {
    return Object.keys(FONT_LABELS).map(key => {
        const sample = applyFontDirect(key, 'Hello');
        return `  *${key}* — ${sample}`;
    }).join('\n');
}

function applyFontDirect(style, text) {
    if (!FONT_MAPS[style]) return text;
    const map = FONT_MAPS[style];
    return [...text].map(ch => map[ch] || ch).join('');
}

module.exports = { applyFont, getFontStyle, setFontStyle, listFonts, FONT_LABELS };
