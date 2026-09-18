// welcomeGoodbye.js
const fs = require('fs');
const path = require('path');
const { getBotName } = require('./botConfig');

// Path to JSON storage in ../data
const dataDir = path.join(__dirname, '..', 'data');
const settingsFile = path.join(dataDir, 'welcomeGoodbye.json');

// --- Ensure data directory exists ---
function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// --- JSON helpers ---
function loadSettings() {
    ensureDataDir();
    if (!fs.existsSync(settingsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    ensureDataDir();
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// --- Formatter ---
async function formatMessage(template, sock, chatId, user) {
    const metadata = await sock.groupMetadata(chatId);
    const groupName = metadata.subject || '';
    const description = metadata.desc || '';
    const membersCount = metadata.participants?.length || 0;

    return template
        .replace(/{user}/g, `@${user.split('@')[0]}`)
        .replace(/{group}/g, groupName)
        .replace(/{description}/g, description)
        .replace(/{bot}/g, getBotName())
        .replace(/{members}/g, membersCount.toString());
}

// --- Welcome functions ---
async function addWelcome(groupId, enabled, message) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].welcomeEnabled = enabled;
    settings[groupId].welcomeMessage = message;
    saveSettings(settings);
}

async function delWelcome(groupId) {
    const settings = loadSettings();
    if (settings[groupId]) {
        settings[groupId].welcomeEnabled = false;
        delete settings[groupId].welcomeMessage;
        saveSettings(settings);
    }
}

async function isWelcomeOn(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeEnabled || false;
}

async function isWelcomeNoPic(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeNoPic || false;
}

async function setWelcomeNoPic(groupId, value) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].welcomeNoPic = value;
    saveSettings(settings);
}

// --- Goodbye functions ---
async function addGoodbye(groupId, enabled, message) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].goodbyeEnabled = enabled;
    settings[groupId].goodbyeMessage = message;
    saveSettings(settings);
}

async function delGoodBye(groupId) {
    const settings = loadSettings();
    if (settings[groupId]) {
        settings[groupId].goodbyeEnabled = false;
        delete settings[groupId].goodbyeMessage;
        saveSettings(settings);
    }
}

async function isGoodByeOn(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.goodbyeEnabled || false;
}

async function isGoodbyeNoPic(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.goodbyeNoPic || false;
}

async function setGoodbyeNoPic(groupId, value) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].goodbyeNoPic = value;
    saveSettings(settings);
}

// --- Command Handlers ---
async function handleWelcome(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `📥 *Welcome Message Setup*\n
✅ *.welcome on* — Enable welcome messages
🛠️ *.welcome set [your message]* — Set a custom welcome message
🚫 *.welcome off* — Disable welcome messages
🖼️ *.welcome nopic on* — Send without profile photo
🖼️ *.welcome nopic off* — Send with profile photo (default)

*Available Variables:*
• {user} - Mentions the new member
• {group} - Shows group name
• {description} - Shows group description
• {bot} - Shows bot name
• {members} - Shows total members in the group`,
            quoted: message
        });
    }

    const [command, subCommand, ...rest] = match.trim().split(' ');
    const customMessage = [subCommand, ...rest].join(' ');

    switch (command.toLowerCase()) {
        case 'on':
            if (await isWelcomeOn(chatId)) {
                return sock.sendMessage(chatId, { text: '⚠️ Welcome messages are already enabled.', quoted: message });
            }
            await addWelcome(chatId, true, 'Welcome {user} to {group}! 🎉 Regards to {bot}. We now have {members} members.');
            return sock.sendMessage(chatId, { text: '✅ Welcome messages enabled. Use *.welcome set [message]* to customize.', quoted: message });

        case 'off':
            if (!(await isWelcomeOn(chatId))) {
                return sock.sendMessage(chatId, { text: '⚠️ Welcome messages are already disabled.', quoted: message });
            }
            await delWelcome(chatId);
            return sock.sendMessage(chatId, { text: '✅ Welcome messages disabled for this group.', quoted: message });

        case 'set': {
            const setMsg = [subCommand, ...rest].join(' ');
            if (!setMsg) {
                return sock.sendMessage(chatId, { text: '⚠️ Provide a custom welcome message. Example: *.welcome set Welcome to the group!*', quoted: message });
            }
            await addWelcome(chatId, true, setMsg);
            return sock.sendMessage(chatId, { text: '✅ Custom welcome message set successfully.', quoted: message });
        }

        case 'nopic':
            if (!subCommand || !['on', 'off'].includes(subCommand.toLowerCase())) {
                const current = await isWelcomeNoPic(chatId);
                return sock.sendMessage(chatId, {
                    text: `🖼️ Welcome photo is currently *${current ? 'disabled' : 'enabled'}*.\n\nUse:\n*.welcome nopic on* — send without photo\n*.welcome nopic off* — send with photo`,
                    quoted: message
                });
            }
            if (subCommand.toLowerCase() === 'on') {
                await setWelcomeNoPic(chatId, true);
                return sock.sendMessage(chatId, { text: '✅ Welcome messages will now be sent *without* profile photo.', quoted: message });
            } else {
                await setWelcomeNoPic(chatId, false);
                return sock.sendMessage(chatId, { text: '✅ Welcome messages will now be sent *with* profile photo.', quoted: message });
            }

        default:
            return sock.sendMessage(chatId, {
                text: `❌ Invalid command. Use:\n*.welcome on* - Enable\n*.welcome set [message]* - Set custom message\n*.welcome off* - Disable\n*.welcome nopic on/off* - Toggle profile photo`,
                quoted: message
            });
    }
}

async function handleGoodbye(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `📤 *Goodbye Message Setup*\n
🔹 *.goodbye on* — Enable goodbye messages
🔹 *.goodbye set [your message]* — Set a custom goodbye message
🔹 *.goodbye off* — Disable goodbye messages
🖼️ *.goodbye nopic on* — Send without profile photo
🖼️ *.goodbye nopic off* — Send with profile photo (default)

*Available Variables:*
🔹 {user} - Mentions the leaving member
🔹 {group} - Shows group name
🔹 {bot} - Shows bot name
🔹 {members} - Shows total members in the group`,
            quoted: message
        });
    }

    const [command, subCommand, ...rest] = match.trim().split(' ');
    const customMessage = [subCommand, ...rest].join(' ');

    switch (command.toLowerCase()) {
        case 'on':
            if (await isGoodByeOn(chatId)) {
                return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are already enabled.', quoted: message });
            }
            await addGoodbye(chatId, true, 'Goodbye {user} from {group}! 👋 Regards, {bot}. We now have {members} members left.');
            return sock.sendMessage(chatId, { text: '✅ Goodbye messages enabled. Use *.goodbye set [message]* to customize.', quoted: message });

        case 'off':
            if (!(await isGoodByeOn(chatId))) {
                return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are already disabled.', quoted: message });
            }
            await delGoodBye(chatId);
            return sock.sendMessage(chatId, { text: '✅ Goodbye messages disabled for this group.', quoted: message });

        case 'set': {
            const setMsg = [subCommand, ...rest].join(' ');
            if (!setMsg) {
                return sock.sendMessage(chatId, { text: '⚠️ Provide a custom goodbye message. Example: *.goodbye set Goodbye!*', quoted: message });
            }
            await addGoodbye(chatId, true, setMsg);
            return sock.sendMessage(chatId, { text: '✅ Custom goodbye message set successfully.', quoted: message });
        }

        case 'nopic':
            if (!subCommand || !['on', 'off'].includes(subCommand.toLowerCase())) {
                const current = await isGoodbyeNoPic(chatId);
                return sock.sendMessage(chatId, {
                    text: `🖼️ Goodbye photo is currently *${current ? 'disabled' : 'enabled'}*.\n\nUse:\n*.goodbye nopic on* — send without photo\n*.goodbye nopic off* — send with photo`,
                    quoted: message
                });
            }
            if (subCommand.toLowerCase() === 'on') {
                await setGoodbyeNoPic(chatId, true);
                return sock.sendMessage(chatId, { text: '✅ Goodbye messages will now be sent *without* profile photo.', quoted: message });
            } else {
                await setGoodbyeNoPic(chatId, false);
                return sock.sendMessage(chatId, { text: '✅ Goodbye messages will now be sent *with* profile photo.', quoted: message });
            }

        default:
            return sock.sendMessage(chatId, {
                text: `❌ Invalid command. Use:\n*.goodbye on* - Enable\n*.goodbye set [message]* - Set custom message\n*.goodbye off* - Disable\n*.goodbye nopic on/off* - Toggle profile photo`,
                quoted: message
            });
    }
}

// --- Getters ---
async function getWelcome(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeMessage || null;
}

async function getGoodbye(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.goodbyeMessage || null;
}

// --- Senders ---
async function sendWelcome(sock, chatId, user) {
    if (!(await isWelcomeOn(chatId))) return;
    const template = await getWelcome(chatId);
    if (!template) return;

    const text = await formatMessage(template, sock, chatId, user);
    await sock.sendMessage(chatId, { text, mentions: [user] });
}

async function sendGoodbye(sock, chatId, user) {
    if (!(await isGoodByeOn(chatId))) return;
    const template = await getGoodbye(chatId);
    if (!template) return;

    const text = await formatMessage(template, sock, chatId, user);
    await sock.sendMessage(chatId, { text, mentions: [user] });
}

module.exports = { 
    handleWelcome, handleGoodbye, 
    addWelcome, delWelcome, isWelcomeOn, isWelcomeNoPic, setWelcomeNoPic,
    addGoodbye, delGoodBye, isGoodByeOn, isGoodbyeNoPic, setGoodbyeNoPic,
    getWelcome, getGoodbye, 
    sendWelcome, sendGoodbye 
};
