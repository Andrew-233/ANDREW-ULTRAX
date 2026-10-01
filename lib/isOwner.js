const { isSudo } = require('./index');
const { compareJids, toUserJid } = require('./jid');
const { getOwnerNumber } = require('./botConfig');

async function isOwnerOrSudo(senderId) {
    try {
        if (typeof senderId !== 'string' || !senderId.trim()) {
            return false;
        }

        // Owner number set via .setownernumber (defaults to the developer)
        const rawNumbers = getOwnerNumber();

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
