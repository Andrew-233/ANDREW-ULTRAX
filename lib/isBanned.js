const fs = require('fs');
const { compareJids } = require('./jid');

function isBanned(userId) {
    try {
        const bannedUsers = JSON.parse(fs.readFileSync('./data/banned.json', 'utf8'));
        return bannedUsers.some(banned => compareJids(banned, userId));
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned };
