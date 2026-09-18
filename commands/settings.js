const fs = require('fs');
const { isSudo } = require('../lib/index');
const { createFakeContact } = require('../lib/fakeContact');
const { getAntiimage, getAntisticker } = require('../lib/database');
const { getAntidemote } = require('../lib/antidemote-file');
const { getAntipromote } = require('../lib/antipromote-file');
const { getBotName } = require('../lib/botConfig');

function readJsonSafe(path, fallback) {
    try {
        const txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

async function settingsCommand(sock, chatId, message) {
    try {
        const botName = getBotName();
        const senderId = message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!' }, { quoted: createFakeContact(message) });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
        const dataDir = './data';

        const modeRaw      = readJsonSafe(`${dataDir}/botMode.json`,       { isPublic: true, mode: 'public' });
        const autoStatus   = readJsonSafe(`${dataDir}/autoStatus.json`,    { enabled: false, reactOn: false });
        const autoread     = readJsonSafe(`${dataDir}/autoread.json`,      { enabled: false });
        const autotyping   = readJsonSafe(`${dataDir}/autotyping.json`,    { enabled: false });
        const pmblocker    = readJsonSafe(`${dataDir}/pmblocker.json`,     { enabled: false });
        const anticall     = readJsonSafe(`${dataDir}/anticall.json`,      { enabled: false });
        const antidelete   = readJsonSafe(`${dataDir}/antidelete.json`,    { enabled: false, mode: 'private' });
        const autorecord   = readJsonSafe(`${dataDir}/autorecording.json`, { enabled: false });
        const prefixCfg    = readJsonSafe(`${dataDir}/prefix.json`,        { prefix: '.' });
        const menuCfg      = readJsonSafe(`${dataDir}/menuSettings.json`,  { menuStyle: '1' });
        const alwaysonline = readJsonSafe(`${dataDir}/alwaysonline.json`,  { enabled: false });
        const autoboth     = readJsonSafe(`${dataDir}/autoboth.json`,      { enabled: false });
        const antistatusm  = readJsonSafe(`${dataDir}/antistatusmention.json`, {});
        const configCfg    = readJsonSafe(`${dataDir}/config.json`,        {});

        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {},
            autoReaction: { enabled: false }
        });

        const autoReactionEnabled = userGroupData.autoReaction?.enabled === true
            || (typeof userGroupData.autoReaction === 'boolean' && userGroupData.autoReaction);

        const modeMap = { public: 'Public', private: 'Private', group: 'Group', pm: 'PM' };
        const rawMode = modeRaw.mode || (modeRaw.isPublic ? 'public' : 'private');
        const displayMode = modeMap[rawMode] || rawMode.charAt(0).toUpperCase() + rawMode.slice(1);

        const groupId = isGroup ? chatId : null;

        const antilinkOn    = groupId ? Boolean(userGroupData.antilink    && userGroupData.antilink[groupId])    : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword && userGroupData.antibadword[groupId]) : false;
        const welcomeOn     = groupId ? Boolean(userGroupData.welcome     && userGroupData.welcome[groupId])     : false;
        const goodbyeOn     = groupId ? Boolean(userGroupData.goodbye     && userGroupData.goodbye[groupId])     : false;
        const chatbotOn     = groupId ? Boolean(userGroupData.chatbot     && userGroupData.chatbot[groupId])     : false;
        const antitagCfg    = groupId ? (userGroupData.antitag  && userGroupData.antitag[groupId])  : null;

        let antiimgCfg   = null;
        let antistkrCfg  = null;
        let antidemoteCfg = null;
        let antipromCfg  = null;

        if (groupId) {
            antiimgCfg    = await getAntiimage(groupId).catch(() => null);
            antistkrCfg   = await getAntisticker(groupId).catch(() => null);
            antidemoteCfg = await getAntidemote(groupId).catch(() => null);
            antipromCfg   = await getAntipromote(groupId).catch(() => null);
        }

        const on = (v) => v ? '✅ ON' : '❌ OFF';

        const lines = [];
        lines.push(` 🔸*${botName} SETTINGS*🔸   `);

        lines.push('');
        lines.push('*🌐 General*');
        lines.push(`🔹 Bot Name     : *${configCfg.botName || botName}*`);
        lines.push(`🔹 Prefix       : *${prefixCfg.prefix || '.'}*`);
        lines.push(`🔹 Mode         : *${displayMode}*`);
        lines.push(`🔹 Menu Style   : *Style ${menuCfg.menuStyle || '1'}*`);
        if (configCfg.autoFont) {
            lines.push(`┃ Auto Font    : *${configCfg.autoFont}*`);
        }

        lines.push('');
        lines.push('*⚙️ AUTOMATION*');
        lines.push(`🔸 Auto Status  : ${on(autoStatus.enabled)}`);
        lines.push(`🔸 Status React : ${on(autoStatus.reactOn)}`);
        lines.push(`🔸 Auto Read    : ${on(autoread.enabled)}`);
        lines.push(`🔸 Auto Typing  : ${on(autotyping.enabled)}`);
        lines.push(`🔸 Auto Record  : ${on(autorecord.enabled)}`);
        lines.push(`🔸 Auto Reaction: ${on(autoReactionEnabled)}`);
        lines.push(`🔸 Auto Both    : ${on(autoboth.enabled)}`);
        lines.push(`🔸 Always Online: ${on(alwaysonline.enabled)}`);

        lines.push('');
        lines.push('*🛡️ PROTECTION (Global)*');
        lines.push(`🔹 PM Blocker        : ${on(pmblocker.enabled)}`);
        lines.push(`🔸 Anti Call         : ${on(anticall.enabled)}`);
        lines.push(`🔹 Anti Delete       : ${on(antidelete.enabled)}${antidelete.enabled ? ` (${antidelete.mode || 'private'})` : ''}`);
        lines.push(`🔹 Anti Status Mention: ${on(antistatusm?.enabled || (Object.keys(antistatusm).length > 0 && antistatusm?.action))}`);

        if (groupId) {
            lines.push('');
            lines.push(`*👥 GROUP Settings*`);
            lines.push(`🔸 ID: ${groupId}`);
            lines.push('');
            lines.push('*🔗 Anti-Spam*');
            if (antilinkOn) {
                const al = userGroupData.antilink[groupId];
                lines.push(`🔸 Anti Link    : ✅ ON (${al.action || 'delete'})`);
            } else {
                lines.push('🔹 Anti Link    : ❌ OFF');
            }
            if (antibadwordOn) {
                const ab = userGroupData.antibadword[groupId];
                lines.push(`🔹 Anti Badword : ✅ ON (${ab.action || 'delete'})`);
            } else {
                lines.push('🔸 Anti Badword : ❌ OFF');
            }
            if (antitagCfg && antitagCfg.enabled) {
                lines.push(`🔸 Anti Tag     : ✅ ON (${antitagCfg.action || 'delete'})`);
            } else {
                lines.push('🔸 Anti Tag     : ❌ OFF');
            }
            if (antiimgCfg && antiimgCfg.enabled) {
                lines.push(`🔸 Anti Image   : ✅ ON (${antiimgCfg.action || 'delete'})`);
            } else {
                lines.push('🔸 Anti Image   : ❌ OFF');
            }
            if (antistkrCfg && antistkrCfg.enabled) {
                lines.push(`🔸 Anti Sticker : ✅ ON (${antistkrCfg.action || 'delete'})`);
            } else {
                lines.push('🔹 Anti Sticker : ❌ OFF');
            }
            if (antidemoteCfg && antidemoteCfg.enabled) {
                lines.push('🔹 Anti Demote  : ✅ ON');
            } else {
                lines.push('🔸 Anti Demote  : ❌ OFF');
            }
            if (antipromCfg && antipromCfg.enabled) {
                lines.push('🔸 Anti Promote : ✅ ON');
            } else {
                lines.push('🔹 Anti Promote : ❌ OFF');
            }
            lines.push('');
            lines.push('*🎉 EVENTS*');
            lines.push(`🔹 Welcome      : ${on(welcomeOn)}`);
            lines.push(`🔹 Goodbye      : ${on(goodbyeOn)}`);
            lines.push(`🔹 Chatbot      : ${on(chatbotOn)}`);
        } else {
            lines.push('');
            lines.push('> _Run this in a group to see group-specific settings._');
        }

        lines.push('');
        lines.push(`> Thanks for choosing ${botName}`);

        await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: createFakeContact(message) });
        await sock.sendMessage(chatId, {
            react: { text: '☑️', key: message.key }
        });
    } catch (error) {
        console.error('Error in settings command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to read settings.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = settingsCommand;
