const { channelInfo } = require('../lib/messageConfig');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const WELCOME_FILE = path.join(__dirname, '..', 'data', 'welcome.json');
const GOODBYE_FILE = path.join(__dirname, '..', 'data', 'goodbye.json');

// Initialize state with defaults
let welcomeState = { onGroups: [], customMessages: {} };
let goodbyeState = { onGroups: [], customMessages: {} };

const { createFakeContact } = require('../lib/fakeContact');
/**
 * Load welcome data from file
 */
async function loadWelcomeData() {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        try {
            const data = await fs.readFile(WELCOME_FILE, 'utf8');
            const parsed = JSON.parse(data);

            welcomeState = {
                onGroups: Array.isArray(parsed.onGroups) ? parsed.onGroups : [],
                customMessages: parsed.customMessages && typeof parsed.customMessages === 'object' ? parsed.customMessages : {}
            };
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                await saveWelcomeData();
            } else {
                throw readError;
            }
        }
    } catch (error) {
        console.error('Error loading welcome data:', error);
        // Keep default empty state
    }
}

/**
 * Save welcome data to file
 */
async function saveWelcomeData() {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const dataToSave = {
            onGroups: welcomeState.onGroups || [],
            customMessages: welcomeState.customMessages || {}
        };

        await fs.writeFile(WELCOME_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Error saving welcome data:', error);
    }
}

/**
 * Load goodbye data from file
 */
async function loadGoodbyeData() {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        try {
            const data = await fs.readFile(GOODBYE_FILE, 'utf8');
            const parsed = JSON.parse(data);

            goodbyeState = {
                onGroups: Array.isArray(parsed.onGroups) ? parsed.onGroups : [],
                customMessages: parsed.customMessages && typeof parsed.customMessages === 'object' ? parsed.customMessages : {}
            };
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                await saveGoodbyeData();
            } else {
                throw readError;
            }
        }
    } catch (error) {
        console.error('Error loading goodbye data:', error);
        // Keep default empty state
    }
}

/**
 * Save goodbye data to file
 */
async function saveGoodbyeData() {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const dataToSave = {
            onGroups: goodbyeState.onGroups || [],
            customMessages: goodbyeState.customMessages || {}
        };

        await fs.writeFile(GOODBYE_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Error saving goodbye data:', error);
    }
}

/**
 * Checks if welcome is enabled for a group.
 */
function isWelcomeOn(chatId) {
    return welcomeState.onGroups.includes(chatId);
}

/**
 * Gets the custom welcome message for a group.
 */
function getWelcome(chatId) {
    return welcomeState.customMessages[chatId] || null;
}

/**
 * Handles the logic to set/get/toggle welcome settings.
 */
async function handleWelcome(sock, chatId, message) {
    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || 
                message.message?.imageMessage?.caption || '';
    const matchText = text.split(' ').slice(1).join(' ');
    const command = matchText.trim().toLowerCase();

    if (command === 'on') {
        if (!welcomeState.onGroups.includes(chatId)) {
            welcomeState.onGroups.push(chatId);
            await saveWelcomeData();
        }
        await sock.sendMessage(chatId, { text: '✅ Welcome messages enabled for this group.' }, { quoted: createFakeContact(message) });
    } else if (command === 'off') {
        welcomeState.onGroups = welcomeState.onGroups.filter(id => id !== chatId);
        await saveWelcomeData();
        await sock.sendMessage(chatId, { text: '✅ Welcome messages disabled for this group.' }, { quoted: createFakeContact(message) });
    } else if (command.startsWith('set ')) {
        const customMsg = matchText.slice(4).trim();
        
        if (customMsg.length > 1000) {
            await sock.sendMessage(chatId, { text: '❌ Custom message too long. Maximum 1000 characters.' }, { quoted: createFakeContact(message) });
            return;
        }
        
        welcomeState.customMessages[chatId] = customMsg;
        await saveWelcomeData();
        await sock.sendMessage(chatId, { text: '✅ Custom welcome message set successfully.' }, { quoted: createFakeContact(message) });
    } else {
        await sock.sendMessage(chatId, {
            text: '📋 *Welcome Commands:*\n\n• `welcome on` - Enable welcome messages\n• `welcome off` - Disable welcome messages\n• `welcome set [text]` - Set custom message\n\n*Available variables:*\n{user} - Mentions the new member\n{group} - Group name\n{description} - Group description\n\n*Example:*\n`welcome set Welcome @{user} to {group}! 🎉`'
        }, { quoted: createFakeContact(message) });
    }
}

/**
 * The main command handler for 'welcome' keyword.
 */
async function welcomeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: createFakeContact(message) });
        return;
    }

    await handleWelcome(sock, chatId, message);
}

/**
 * Handles the event when someone joins the group.
 */
async function handleJoinEvent(sock, id, participants) {
    if (!isWelcomeOn(id)) return;

    const customMessage = getWelcome(id);
    
    try {
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject || 'Group';
        const groupDesc = groupMetadata.desc || 'No description available';

        const participantsArray = Array.isArray(participants) ? participants : [participants];
        
        for (const participant of participantsArray) {
            try {
                const participantId = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                
                if (!participantId || typeof participantId !== 'string') continue;
                
                const userNumber = participantId.split('@')[0];
                let displayName = `@${userNumber}`;

                let finalMessage;
                if (customMessage) {
                    finalMessage = customMessage
                        .replace(/{user}/g, displayName)
                        .replace(/{group}/g, groupName)
                        .replace(/{description}/g, groupDesc);
                } else {
                    finalMessage = `👋 Welcome ${displayName} to *${groupName}*! 🎉`;
                }

                const messageOptions = {
                    text: finalMessage,
                    mentions: [participantId]
                };

                if (channelInfo && typeof channelInfo === 'object' && !Array.isArray(channelInfo)) {
                    Object.assign(messageOptions, channelInfo);
                }

                await sock.sendMessage(id, messageOptions);
            } catch (error) {
                console.error('Error sending welcome message for participant:', error);
            }
        }
    } catch (error) {
        console.error('Error in handleJoinEvent:', error);
    }
}

/**
 * Checks if goodbye is enabled for a group.
 */
function isGoodbyeOn(chatId) {
    return goodbyeState.onGroups.includes(chatId);
}

/**
 * Gets the custom goodbye message for a group.
 */
function getGoodbye(chatId) {
    return goodbyeState.customMessages[chatId] || null;
}

/**
 * Handles the logic to set/get/toggle goodbye settings.
 */
async function handleGoodbye(sock, chatId, message, matchText) {
    const command = matchText.trim().toLowerCase();

    if (command === 'on') {
        if (!goodbyeState.onGroups.includes(chatId)) {
            goodbyeState.onGroups.push(chatId);
            await saveGoodbyeData();
        }
        await sock.sendMessage(chatId, { text: '✅ Goodbye messages enabled for this group.' }, { quoted: createFakeContact(message) });
    } else if (command === 'off') {
        goodbyeState.onGroups = goodbyeState.onGroups.filter(id => id !== chatId);
        await saveGoodbyeData();
        await sock.sendMessage(chatId, { text: '✅ Goodbye messages disabled for this group.' }, { quoted: createFakeContact(message) });
    } else if (command.startsWith('set ')) {
        const customMsg = matchText.slice(4).trim();
        
        if (customMsg.length > 1000) {
            await sock.sendMessage(chatId, { text: '❌ Custom message too long. Maximum 1000 characters.' }, { quoted: createFakeContact(message) });
            return;
        }
        
        goodbyeState.customMessages[chatId] = customMsg;
        await saveGoodbyeData();
        await sock.sendMessage(chatId, { text: '✅ Custom goodbye message set successfully.' }, { quoted: createFakeContact(message) });
    } else {
        await sock.sendMessage(chatId, {
            text: '📋 *Goodbye Commands:*\n\n• `goodbye on` - Enable goodbye messages\n• `goodbye off` - Disable goodbye messages\n• `goodbye set [text]` - Set custom message\n\n*Available variables:*\n{user} - Mentions the leaving member\n{group} - Group name\n{description} - Group description\n\n*Example:*\n`goodbye set Goodbye @{user}, we\'ll miss you in {group}! 👋`'
        }, { quoted: createFakeContact(message) });
    }
}

/**
 * The main command handler for 'goodbye' keyword.
 */
async function goodbyeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: createFakeContact(message) });
        return;
    }

    const text = message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption || '';
    
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

/**
 * Handles the event when someone leaves the group.
 */
async function handleLeaveEvent(sock, id, participants) {
    if (!isGoodbyeOn(id)) return;

    const customMessage = getGoodbye(id);
    
    try {
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject || 'Group';
        const groupDesc = groupMetadata.desc || 'No description available';

        const participantsArray = Array.isArray(participants) ? participants : [participants];
        
        for (const participant of participantsArray) {
            try {
                const participantId = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                
                if (!participantId || typeof participantId !== 'string') continue;
                
                const userNumber = participantId.split('@')[0];
                let displayName = `@${userNumber}`;

                let finalMessage;
                if (customMessage) {
                    finalMessage = customMessage
                        .replace(/{user}/g, displayName)
                        .replace(/{group}/g, groupName)
                        .replace(/{description}/g, groupDesc);
                } else {
                    finalMessage = `👋 Goodbye ${displayName}! Thanks for being part of *${groupName}*.`;
                }

                const messageOptions = {
                    text: finalMessage,
                    mentions: [participantId]
                };

                if (channelInfo && typeof channelInfo === 'object' && !Array.isArray(channelInfo)) {
                    Object.assign(messageOptions, channelInfo);
                }

                await sock.sendMessage(id, messageOptions);
            } catch (error) {
                console.error('Error sending goodbye message for participant:', error);
            }
        }
    } catch (error) {
        console.error('Error in handleLeaveEvent:', error);
    }
}

/**
 * Clean up inactive groups from state
 */
async function cleanupInactiveGroups(sock) {
    if (!sock || typeof sock.groupMetadata !== 'function') return;
    
    try {
        const validWelcomeGroups = [];
        for (const groupId of welcomeState.onGroups) {
            try {
                if (groupId && typeof groupId === 'string' && groupId.endsWith('@g.us')) {
                    await sock.groupMetadata(groupId);
                    validWelcomeGroups.push(groupId);
                }
            } catch {
                // Group no longer accessible, skip it
            }
        }
        welcomeState.onGroups = validWelcomeGroups;
        await saveWelcomeData();

        const validGoodbyeGroups = [];
        for (const groupId of goodbyeState.onGroups) {
            try {
                if (groupId && typeof groupId === 'string' && groupId.endsWith('@g.us')) {
                    await sock.groupMetadata(groupId);
                    validGoodbyeGroups.push(groupId);
                }
            } catch {
                // Group no longer accessible, skip it
            }
        }
        goodbyeState.onGroups = validGoodbyeGroups;
        await saveGoodbyeData();
    } catch (error) {
        console.error('Error cleaning up inactive groups:', error);
    }
}

// Load data when module is imported
Promise.all([
    loadWelcomeData(),
    loadGoodbyeData()
]).catch(console.error);

module.exports = {
    welcomeCommand,
    handleJoinEvent,
    isWelcomeOn,
    getWelcome,
    handleWelcome,
    loadWelcomeData,
    saveWelcomeData,
    goodbyeCommand,
    handleLeaveEvent,
    isGoodbyeOn,
    getGoodbye,
    handleGoodbye,
    loadGoodbyeData,
    saveGoodbyeData,
    cleanupInactiveGroups
};
