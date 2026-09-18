const settings = require('../settings');
const { isSudo } = require('./index');
const { compareJids, toUserJid } = require('./jid');
const { getOwnerNumber } = require('./botConfig');

async function isOwnerOrSudo(senderId) {
    try {
        if (typeof senderId !== 'string' || !senderId.trim()) {
            return false;
        }

        // Check dynamically stored owner number first, then fall back to settings
        const storedNumber = getOwnerNumber();
        const rawNumbers = [storedNumber, settings?.ownerNumber]
            .filter(Boolean)
            .join(',');

        if (rawNumbers) {
            const ownerNumbers = rawNumbers
                .split(',')
                .map(n => n.trim())
                .filter(Boolean);

            for (const num of ownerNumbers) {
                const ownerJid = toUserJid(num);
                if (ownerJid && compareJids(senderId, ownerJid)) {
                    return true;
                }
            }
        }

        // Check sudo list
        const sudoStatus = await isSudo(senderId);
        return Boolean(sudoStatus);
    } catch (error) {
        console.error(`[isOwnerOrSudo] Error for sender ${senderId}: ${error.message}`);
        return false;
    }
}

module.exports = isOwnerOrSudo;
