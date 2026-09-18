const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Store for counting detected tagall messages
const antitagStats = new Map();

const { createFakeContact } = require('../lib/fakeContact');
async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: createFakeContact(message) });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `\`\`\`ANTITAG SETUP\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off\n${prefix}antitag stats\n\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: createFakeContact(message) });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antitag is already on_*' }, { quoted: createFakeContact(message) });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '*_Antitag has been turned ON_*' : '*_Failed to turn on Antitag_*' 
                }, { quoted: createFakeContact(message) });
                break;

            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_Antitag has been turned OFF_*' }, { quoted: createFakeContact(message) });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please specify an action: ${prefix}antitag set delete | kick_*` 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Invalid action. Choose delete or kick._*' 
                    }, { quoted: createFakeContact(message) });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antitag action set to ${setAction}_*` : '*_Failed to set Antitag action_*' 
                }, { quoted: createFakeContact(message) });
                break;

            case 'get':
                const status = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: `*_Antitag Configuration:_*\nStatus: ${status?.enabled ? 'ON' : 'OFF'}\nAction: ${status?.action || 'delete'}\nTotal Detected: ${getGroupStats(chatId) || 0} messages` 
                }, { quoted: createFakeContact(message) });
                break;

            case 'stats':
            case 'info':
                const config = await getAntitag(chatId, 'on');
                const stats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `*_📊 ANTITAG STATISTICS_*\n\n🔹 *Status:* ${config?.enabled ? '🟢 ON' : '🔴 OFF'}\n🔹 *Action:* ${config?.action || 'delete'}\n🔹 *Total Detected:* ${stats || 0} messages\n🔹 *Last Reset:* ${getLastResetTime(chatId)}` 
                }, { quoted: createFakeContact(message) });
                break;

            case 'reset':
            case 'clear':
                resetGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: '*_Antitag statistics have been reset_*' 
                }, { quoted: createFakeContact(message) });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antitag for usage._*` }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antitag command_*' }, { quoted: createFakeContact(message) });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        // Early return if not a group
        if (!chatId.endsWith('@g.us')) return;

        const antitagSetting = await getAntitag(chatId, 'on');
        if (!antitagSetting || !antitagSetting.enabled) return;

        // Get group metadata once and cache if needed
        let groupMetadata;
        let totalParticipants = 0;
        
        // Get mentioned JIDs from contextInfo (proper mentions)
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Extract text from all possible message types - optimized extraction
        let messageText = '';
        const msg = message.message;
        if (msg.conversation) {
            messageText = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            messageText = msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
            messageText = msg.imageMessage.caption;
        } else if (msg.videoMessage?.caption) {
            messageText = msg.videoMessage.caption;
        } else if (msg.documentMessage?.caption) {
            messageText = msg.documentMessage.caption;
        }

        // Early return if no text content
        if (!messageText && mentionedJids.length === 0) return;

        // FAST mention detection - optimized regex
        const textMentions = messageText.match(/@[\d\s\-().]+/g) || [];
        const numericMentions = messageText.match(/@\d{8,}/g) || []; // Reduced from 10 to 8 for faster detection
        
        // Count unique mentions - optimized logic
        const uniqueMentions = new Set();
        
        // Add proper WhatsApp mentions
        for (const jid of mentionedJids) {
            if (jid && jid.includes('@s.whatsapp.net')) {
                uniqueMentions.add(jid.split('@')[0]);
            }
        }
        
        // Add text mentions - optimized processing
        for (const mention of textMentions) {
            const cleanMention = mention.replace(/@/g, '').replace(/[^\d]/g, '');
            if (cleanMention.length >= 8) { // Reduced threshold for faster detection
                uniqueMentions.add(cleanMention);
            }
        }
        
        // Add numeric mentions
        for (const mention of numericMentions) {
            const numMatch = mention.match(/@(\d+)/);
            if (numMatch) uniqueMentions.add(numMatch[1]);
        }

        const totalUniqueMentions = uniqueMentions.size;

        // FAST threshold detection - simplified logic
        if (totalUniqueMentions >= 3) {
            // Get group metadata only when needed
            if (!groupMetadata) {
                groupMetadata = await sock.groupMetadata(chatId);
                totalParticipants = groupMetadata.participants?.length || 0;
            }
            
            // Faster threshold calculation
            let mentionThreshold;
            if (totalParticipants <= 10) mentionThreshold = 3;
            else if (totalParticipants <= 30) mentionThreshold = Math.max(3, Math.ceil(totalParticipants * 0.3)); // Reduced from 0.4
            else mentionThreshold = Math.max(5, Math.ceil(totalParticipants * 0.25)); // Reduced from 0.3

            // Faster condition checks
            const hasMassMentions = totalUniqueMentions >= mentionThreshold;
            const hasManyNumericMentions = numericMentions.length >= 5; // Reduced from 8
            const hasExcessiveMentions = totalUniqueMentions >= 10; // Reduced from 15

            if (hasMassMentions || hasManyNumericMentions || hasExcessiveMentions) {
                // Increment statistics
                incrementGroupStats(chatId);
                
                const action = antitagSetting.action || 'delete';
                const stats = getGroupStats(chatId);
                
                // PARALLEL processing for speed
                const actions = [];
                
                // Always try to delete the message first
                actions.push(
                    sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    }, { quoted: createFakeContact(message) }).catch(err => console.error('Delete failed:', err))
                );

                if (action === 'kick') {
                    // Kick user in parallel
                    actions.push(
                        sock.groupParticipantsUpdate(chatId, [senderId], "remove")
                            .then(() => {
                                return sock.sendMessage(chatId, {
                                    text: `🚫 *Antitag Detected!*\n\n📍 *Mentions:* ${totalUniqueMentions} users\n👤 *User:* @${senderId.split('@')[0]}\n📊 *Total Detected:* ${stats} messages\n⚡ *Action:* User kicked`,
                                    mentions: [senderId]
                                });
                            })
                            .catch(kickError => {
                                console.error('Kick failed:', kickError);
                                return sock.sendMessage(chatId, {
                                    text: `⚠️ *Tagall Detected!*\nFailed to kick user. Message was deleted.`
                                }, { quoted: createFakeContact(message) });
                            })
                    );
                } else {
                    // Send delete notification
                    actions.push(
                        sock.sendMessage(chatId, {
                            text: `⚠️ *Tagall Detected!*\n\n📍 *Mentions:* ${totalUniqueMentions} users\n📊 *Total Detected:* ${stats} messages\n🚫 *Action:* Message deleted`
                        })
                    );
                }

                // Execute all actions in parallel
                await Promise.allSettled(actions);
                
                console.log(`[ANTITAG] Group: ${chatId}, Mentions: ${totalUniqueMentions}, Action: ${action}, Total: ${stats}`);
            }
        }
    } catch (error) {
        console.error('Error in tag detection:', error);
    }
}

// Statistics management functions
function incrementGroupStats(chatId) {
    const stats = antitagStats.get(chatId) || { count: 0, lastReset: new Date() };
    stats.count++;
    antitagStats.set(chatId, stats);
}

function getGroupStats(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.count : 0;
}

function resetGroupStats(chatId) {
    antitagStats.set(chatId, { count: 0, lastReset: new Date() });
}

function getLastResetTime(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.lastReset.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }) : 'Never';
}

// Export functions for external access
function getAllAntitagStats() {
    const stats = {};
    antitagStats.forEach((value, key) => {
        stats[key] = value;
    });
    return stats;
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection,
    getGroupStats,
    resetGroupStats,
    getAllAntitagStats
};
