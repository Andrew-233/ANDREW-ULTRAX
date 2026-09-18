const os = require('os');
const { getBotName } = require('../lib/botConfig');
const settings = require('../settings');
const { createFakeContact } = require('../lib/fakeContact');

const botStartTime = Date.now();

const detectPlatform = () => {
    if (process.env.DYNO) return '☁️ Heroku';
    if (process.env.RENDER) return '⚡ Render';
    if (process.env.PREFIX && process.env.PREFIX.includes('termux')) return '📱 Termux';
    if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return '🌀 CypherX Platform';
    if (process.env.P_SERVER_UUID) return '🖥️ Panel';
    if (process.env.LXC) return '🐦‍⬛ Linux Container (LXC)';
    switch (os.platform()) {
        case 'win32': return '🪟 Windows';
        case 'darwin': return '🍎 macOS';
        case 'linux': return '🐧 Linux';
        default: return '❓ Unknown';
    }
};

function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function botInfoCommand(sock, chatId, message) {
    try {
        const uptime = Date.now() - botStartTime;
        const platform = detectPlatform();
        const botName = getBotName();
        const version = settings.version || 'N/A';
        const ownerNumber = settings.ownerNumber || 'N/A';
        const botOwner = settings.botOwner || 'N/A';
        const commandMode = settings.commandMode || 'N/A';

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

        const cpus = os.cpus();
        const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown';
        const cpuCores = cpus.length;

        const nodeVersion = process.version;
        const arch = os.arch();
        const hostname = os.hostname();
        const osType = `${os.type()} ${os.release()}`;

        const text = `
 🤖 *BOT INFORMATION*

🔷 *Bot Details:*
🔹 *Name:* ${botName}
🔹 *Version:* v${version}
🔹 *Owner:* ${botOwner}
🔹 *Owner Number:* +${ownerNumber}
🔹 *Mode:* ${commandMode}
🔹 *Uptime:* ${formatUptime(uptime)}

🔶 *Server Info:*
🔸 *Platform:* ${platform}
🔸 *OS:* ${osType}
🔸 *Architecture:* ${arch}
🔸 *Hostname:* ${hostname}
🔸 *Node.js:* ${nodeVersion}

⚙️ *CPU:*
🔹 *Model:* ${cpuModel}
🔸 *Cores:* ${cpuCores}

💾 *Memory:*
🔸 *Total:* ${formatBytes(totalMem)}
🔹 *Used:* ${formatBytes(usedMem)} (${memPercent}%)
🔸 *Free:* ${formatBytes(freeMem)}
`.trim();

        await sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in botinfo command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch bot information.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = botInfoCommand;
