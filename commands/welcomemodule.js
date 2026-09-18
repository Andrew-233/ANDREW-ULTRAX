const fs = require('fs');
const path = require('path');

// ===== ADMIN CHECK =====
async function isAdmin(sock, chatId, userId) {
    try {
        const meta = await sock.groupMetadata(chatId);
        const admins = meta.participants.filter(v => v.admin);
        return { isSenderAdmin: admins.some(v => v.id === userId) };
    } catch {
        return { isSenderAdmin: false };
    }
}

// ===== PATH =====
const filePath = path.join(__dirname, '../data/welcome.json');

if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

// ===== LOAD/SAVE =====
function loadData() {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath));
    } catch {}
    return {};
}

function saveData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===== FORMAT =====
function format(msg, user, group, count) {
    return msg
        .replace(/{user}/g, `@${user.split('@')[0]}`)
        .replace(/{group}/g, group)
        .replace(/{count}/g, count);
}

// ===== HELPER: extract text from message =====
function getMsgText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        ''
    ).toLowerCase().trim();
}

// ===== COMMAND: .welcome on/off =====
async function welcomeCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' });
        }

        const sender = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin } = await isAdmin(sock, chatId, sender);

        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' });
        }

        const text = getMsgText(message);
        let data = loadData();
        if (!data[chatId]) data[chatId] = { welcome: { enabled: false, message: null }, goodbye: { enabled: false, message: null } };
        if (!data[chatId].welcome) data[chatId].welcome = { enabled: false, message: null };

        if (text.includes('on')) data[chatId].welcome.enabled = true;
        else if (text.includes('off')) data[chatId].welcome.enabled = false;
        else data[chatId].welcome.enabled = !data[chatId].welcome.enabled;

        saveData(data);
        await sock.sendMessage(chatId, {
            text: `✅ Welcome messages ${data[chatId].welcome.enabled ? 'ENABLED 🎉' : 'DISABLED ❌'}`
        });
    } catch (e) {
        console.log('[welcomeCommand]', e.message);
    }
}

// ===== COMMAND: .goodbye on/off =====
async function goodbyeCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' });
        }

        const sender = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin } = await isAdmin(sock, chatId, sender);

        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' });
        }

        const text = getMsgText(message);
        let data = loadData();
        if (!data[chatId]) data[chatId] = { welcome: { enabled: false, message: null }, goodbye: { enabled: false, message: null } };
        if (!data[chatId].goodbye) data[chatId].goodbye = { enabled: false, message: null };

        if (text.includes('on')) data[chatId].goodbye.enabled = true;
        else if (text.includes('off')) data[chatId].goodbye.enabled = false;
        else data[chatId].goodbye.enabled = !data[chatId].goodbye.enabled;

        saveData(data);
        await sock.sendMessage(chatId, {
            text: `✅ Goodbye messages ${data[chatId].goodbye.enabled ? 'ENABLED 👋' : 'DISABLED ❌'}`
        });
    } catch (e) {
        console.log('[goodbyeCommand]', e.message);
    }
}

// ===== COMMAND: .setwelcome =====
async function setwelcomeCommand(sock, chatId, senderId, message, userMessage) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' });
        }

        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' });
        }

        const prefix = userMessage.match(/^[^a-z0-9]*/i)?.[0] || '.';
        const msg = userMessage.replace(new RegExp(`^\\${prefix}setwelcome\\s*`, 'i'), '').trim();

        if (!msg) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a message.\nExample: .setwelcome Welcome {user} to {group}! 🎉\n\nVariables: {user}, {group}, {count}'
            });
        }

        let data = loadData();
        if (!data[chatId]) data[chatId] = { welcome: { enabled: false, message: null }, goodbye: { enabled: false, message: null } };
        if (!data[chatId].welcome) data[chatId].welcome = { enabled: false, message: null };

        data[chatId].welcome.message = msg;
        data[chatId].welcome.enabled = true;
        saveData(data);

        await sock.sendMessage(chatId, { text: `✅ Welcome message saved and enabled!\n\nPreview:\n${msg}` });
    } catch (e) {
        console.log('[setwelcomeCommand]', e.message);
    }
}

// ===== COMMAND: .setgoodbye =====
async function setgoodbyeCommand(sock, chatId, senderId, message, userMessage) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' });
        }

        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' });
        }

        const prefix = userMessage.match(/^[^a-z0-9]*/i)?.[0] || '.';
        const msg = userMessage.replace(new RegExp(`^\\${prefix}setgoodbye\\s*`, 'i'), '').trim();

        if (!msg) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a message.\nExample: .setgoodbye Goodbye {user}, we will miss you! 😢\n\nVariables: {user}, {group}, {count}'
            });
        }

        let data = loadData();
        if (!data[chatId]) data[chatId] = { welcome: { enabled: false, message: null }, goodbye: { enabled: false, message: null } };
        if (!data[chatId].goodbye) data[chatId].goodbye = { enabled: false, message: null };

        data[chatId].goodbye.message = msg;
        data[chatId].goodbye.enabled = true;
        saveData(data);

        await sock.sendMessage(chatId, { text: `✅ Goodbye message saved and enabled!\n\nPreview:\n${msg}` });
    } catch (e) {
        console.log('[setgoodbyeCommand]', e.message);
    }
}

// ===== COMMAND: .showwelcome / .showgoodbye =====
async function showsettingsCommand(sock, chatId, message, userMessage) {
    try {
        let data = loadData();
        const groupData = data[chatId] || {};
        const welcome = groupData.welcome || { enabled: false, message: null };
        const goodbye = groupData.goodbye || { enabled: false, message: null };

        const isShowingGoodbye = userMessage && userMessage.includes('goodbye');

        if (isShowingGoodbye) {
            await sock.sendMessage(chatId, {
                text: `*Goodbye Settings*\n\nStatus: ${goodbye.enabled ? '✅ Enabled' : '❌ Disabled'}\nMessage: ${goodbye.message || '_(default)_'}`
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `*Welcome Settings*\n\nStatus: ${welcome.enabled ? '✅ Enabled' : '❌ Disabled'}\nMessage: ${welcome.message || '_(default)_'}`
            });
        }
    } catch (e) {
        console.log('[showsettingsCommand]', e.message);
    }
}

// ===== COMMAND: .resetwelcome / .resetgoodbye =====
async function resetCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' });
        }

        let data = loadData();
        const isGoodbye = userMessage && userMessage.includes('goodbye');

        if (!data[chatId]) data[chatId] = {};

        if (isGoodbye) {
            data[chatId].goodbye = { enabled: false, message: null };
            saveData(data);
            await sock.sendMessage(chatId, { text: '✅ Goodbye message reset to default.' });
        } else {
            data[chatId].welcome = { enabled: false, message: null };
            saveData(data);
            await sock.sendMessage(chatId, { text: '✅ Welcome message reset to default.' });
        }
    } catch (e) {
        console.log('[resetCommand]', e.message);
    }
}

// ===== EVENT: User joins group =====
async function handleJoinEvent(sock, groupId, users) {
    try {
        let data = loadData();
        const groupData = data[groupId];
        if (!groupData?.welcome?.enabled) return;

        const meta = await sock.groupMetadata(groupId);
        const group = meta.subject;
        const count = meta.participants.length;

        for (let user of users) {
            let msg = groupData.welcome.message || '👋 Welcome {user} to *{group}*! 🎉\nWe are now *{count}* members.';
            msg = format(msg, user, group, count);

            await sock.sendMessage(groupId, {
                text: msg,
                mentions: [user]
            });
        }
    } catch (e) {
        console.log('[handleJoinEvent]', e.message);
    }
}

// ===== EVENT: User leaves group =====
async function handleLeaveEvent(sock, groupId, users) {
    try {
        let data = loadData();
        const groupData = data[groupId];
        if (!groupData?.goodbye?.enabled) return;

        const meta = await sock.groupMetadata(groupId).catch(() => null);
        const group = meta?.subject || 'the group';
        const count = meta?.participants?.length || 0;

        for (let user of users) {
            let msg = groupData.goodbye.message || '👋 Goodbye @{user}! We\'ll miss you in *{group}*.';
            msg = format(msg, user, group, count);

            await sock.sendMessage(groupId, {
                text: msg,
                mentions: [user]
            });
        }
    } catch (e) {
        console.log('[handleLeaveEvent]', e.message);
    }
}

module.exports = {
    welcomeCommand,
    goodbyeCommand,
    setwelcomeCommand,
    setgoodbyeCommand,
    showsettingsCommand,
    resetCommand,
    handleJoinEvent,
    handleLeaveEvent
};
