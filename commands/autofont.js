const { getFontStyle, setFontStyle, listFonts, FONT_LABELS } = require('../lib/autoFont');
const { createFakeContact } = require('../lib/fakeContact');
const { getConfig, updateConfig } = require('../lib/botConfig');

const VALID_FONTS = Object.keys(FONT_LABELS);

async function autofontCommand(sock, chatId, message, isOwner) {
    const fake = createFakeContact(message);
    const rawText = (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        ''
    ).trim();

    const arg = rawText.split(/\s+/).slice(1).join(' ').toLowerCase().trim();

    if (!arg || arg === 'status') {
        const current = getFontStyle();
        await sock.sendMessage(chatId, {
            text: `*Auto Font*\n\nCurrent: *${current}*\n\nUse *.autofont <name>* to set a font\nUse *.autofont off* to disable\nUse *.autofont list* to see all fonts`,
        }, { quoted: fake });
        return;
    }

    if (arg === 'list') {
        await sock.sendMessage(chatId, {
            text: `*Available Fonts:*\n\n${listFonts()}\n\n_Use .autofont <name> to apply_`,
        }, { quoted: fake });
        return;
    }

    if (!isOwner) {
        await sock.sendMessage(chatId, {
            text: 'Only the bot owner can change the auto font.',
        }, { quoted: fake });
        return;
    }

    if (arg === 'off' || arg === 'normal' || arg === 'disable') {
        const current = getFontStyle();
        if (current !== 'off') updateConfig({ lastFont: current });
        setFontStyle('off');
        await sock.sendMessage(chatId, {
            text: 'Auto font disabled. Bot will use normal text.',
        }, { quoted: fake });
        return;
    }

    if (arg === 'on' || arg === 'enable') {
        const last = getConfig().lastFont || 'bold';
        setFontStyle(last);
        await sock.sendMessage(chatId, {
            text: `Auto font enabled. Using *${last}*.`,
        }, { quoted: fake });
        return;
    }

    const matched = VALID_FONTS.find(f => f === arg || f.replace('_', '') === arg.replace(/[\s_]/g, ''));
    if (!matched) {
        await sock.sendMessage(chatId, {
            text: `Unknown font *${arg}*.\n\nUse *.autofont list* to see all available fonts.`,
        }, { quoted: fake });
        return;
    }

    setFontStyle(matched);
    await sock.sendMessage(chatId, {
        text: `Auto font set to *${matched}*. All bot text replies will now use this style.`,
    }, { quoted: fake });
}

module.exports = { autofontCommand };
