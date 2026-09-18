const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

// Ensure data directory exists
const { createFakeContact } = require('../lib/fakeContact');
function ensureDataDirectory() {
    const dataDir = path.dirname(dataFilePath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadMessageCounts() {
    try {
        ensureDataDirectory();
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            // Handle empty file case
            if (!data.trim()) {
                return {};
            }
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error loading message counts:', error);
        return {};
    }
}

function saveMessageCounts(messageCounts) {
    try {
        ensureDataDirectory();
        fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
    } catch (error) {
        console.error('Error saving message counts:', error);
    }
}

function incrementMessageCount(groupId, userId) {
    try {
        const messageCounts = loadMessageCounts();

        if (!messageCounts[groupId]) {
            messageCounts[groupId] = {};
        }

        if (!messageCounts[groupId][userId]) {
            messageCounts[groupId][userId] = 0;
        }

        messageCounts[groupId][userId] += 1;

        saveMessageCounts(messageCounts);
    } catch (error) {
        console.error('Error incrementing message count:', error);
    }
}

function topMembers(sock, chatId, isGroup, count = 5) {
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'This command is only available in group chats.' }, { quoted: createFakeContact(message) });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        const sortedMembers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, count);

        if (sortedMembers.length === 0) {
            sock.sendMessage(chatId, { text: 'No message activity recorded yet.' }, { quoted: createFakeContact(message) });
            return;
        }

        let message = `🏆 Top ${sortedMembers.length} Members Based on Message Count:\n\n`;
        const mentions = [];
        
        sortedMembers.forEach(([userId, messageCount], index) => {
            const rankIcons = ['🥇', '🥈', '🥉', '🔹', '🔸'];
            const rankIcon = rankIcons[index] || '🔹';
            const username = userId.split('@')[0];
            
            message += `${index + 1}. ${rankIcon} @${username} - ${messageCount} message${messageCount !== 1 ? 's' : ''}\n`;
            mentions.push(userId);
        });

        const totalMessages = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
        message += `\n📊 Total group messages: ${totalMessages}`;

        sock.sendMessage(chatId, { 
            text: message, 
            mentions: mentions 
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in topMembers command:', error);
        sock.sendMessage(chatId, { text: 'An error occurred while fetching top members.' }, { quoted: createFakeContact(message) });
    }
}

// New function to get user's message count
function getUserRank(sock, chatId, isGroup, userId) {
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'This command is only available in group chats.' }, { quoted: createFakeContact(message) });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        if (!groupCounts[userId]) {
            sock.sendMessage(chatId, { text: 'No messages recorded for this user yet.' }, { quoted: createFakeContact(message) });
            return;
        }

        const sortedMembers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a);

        const userRank = sortedMembers.findIndex(([id]) => id === userId) + 1;
        const userMessageCount = groupCounts[userId];
        const totalMembers = sortedMembers.length;

        const message = `📊 Your Message Stats:\n\n` +
                       `🏅 Rank: ${userRank}/${totalMembers}\n` +
                       `💬 Messages: ${userMessageCount}\n` +
                       `📈 Top ${Math.round((userRank / totalMembers) * 100)}% of active members`;

        sock.sendMessage(chatId, { text: message, mentions: [userId] }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in getUserRank command:', error);
        sock.sendMessage(chatId, { text: 'An error occurred while fetching user rank.' }, { quoted: createFakeContact(message) });
    }
}

// New function to reset message counts (admin only)
function resetMessageCounts(groupId) {
    try {
        const messageCounts = loadMessageCounts();
        if (messageCounts[groupId]) {
            delete messageCounts[groupId];
            saveMessageCounts(messageCounts);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error resetting message counts:', error);
        return false;
    }
}

// New function to get group statistics
function getGroupStats(sock, chatId, isGroup) {
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'This command is only available in group chats.' }, { quoted: createFakeContact(message) });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        const totalMessages = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
        const activeMembers = Object.keys(groupCounts).length;
        
        const sortedCounts = Object.values(groupCounts).sort((a, b) => b - a);
        const averageMessages = activeMembers > 0 ? Math.round(totalMessages / activeMembers) : 0;
        
        let message = `📊 Group Message Statistics:\n\n` +
                     `👥 Active Members: ${activeMembers}\n` +
                     `💬 Total Messages: ${totalMessages}\n` +
                     `📈 Average per Member: ${averageMessages}\n` +
                     `🔥 Most Active: ${sortedCounts[0] || 0} messages`;

        sock.sendMessage(chatId, { text: message }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in getGroupStats command:', error);
        sock.sendMessage(chatId, { text: 'An error occurred while fetching group statistics.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = { 
    incrementMessageCount, 
    topMembers, 
    getUserRank, 
    resetMessageCounts,
    getGroupStats 
};
