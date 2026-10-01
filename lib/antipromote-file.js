const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'antipromote.json');

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, '{}');
    }
}

async function setAntipromote(chatId, status, userId = null) {
    await ensureDataDir();
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
    data[chatId] = {
        enabled: status === 'on',
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
        blockedCount: data[chatId]?.blockedCount || 0
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    return data[chatId];
}

async function getAntipromote(chatId) {
    await ensureDataDir();
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
    if (data[chatId]) {
        return { chatId, ...data[chatId], enabled: data[chatId].enabled || data[chatId].status === 'on' };
    }
    return { chatId, enabled: false, status: 'off', updatedAt: null, blockedCount: 0 };
}

async function removeAntipromote(chatId) {
    await ensureDataDir();
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
    if (data[chatId]) {
        delete data[chatId];
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    }
    return true;
}

async function incrementBlockedCount(chatId) {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        if (data[chatId]) {
            data[chatId].blockedCount = (data[chatId].blockedCount || 0) + 1;
            await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('Error incrementing blocked count:', error);
    }
}

module.exports = {
    setAntipromote,
    getAntipromote,
    removeAntipromote,
    incrementBlockedCount,
    ensureDataDir
};
