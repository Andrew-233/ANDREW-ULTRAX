const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');

// Path to store owner settings
const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');
const DEFAULT_OWNER_NAME = 'Not set !';

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize owner file if it doesn't exist
if (!fs.existsSync(OWNER_FILE)) {
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
}

const { createFakeContact } = require('../lib/fakeContact');

/**
 * Get the current owner name
 */
function getOwnerName() {
    try {
        const data = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
        return data.ownerName || DEFAULT_OWNER_NAME;
    } catch (error) {
        console.error('Error reading owner file:', error);
        return DEFAULT_OWNER_NAME;
    }
}

/**
 * Set new owner name – saves exactly as provided (including spaces)
 */
function setOwnerName(newOwnerName) {
    try {
        if (!newOwnerName || newOwnerName.length > 20) return false; // raw length check
        
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: newOwnerName }, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting owner name:', error);
        return false;
    }
}

/**
 * Reset owner name to default
 */
function resetOwnerName() {
    try {
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting owner name:', error);
        return false;
    }
}

/**
 * Validate owner name – now checks raw length and allows any characters
 */
function validateOwnerName(name) {
    if (!name) return { isValid: false, message: 'Owner name cannot be empty!' };
    
    // Reject if only whitespace
    if (!name.trim()) return { isValid: false, message: 'Owner name cannot be only spaces!' };
    
    // Raw length must be 1-20 characters (including spaces)
    if (name.length > 20) return { isValid: false, message: 'Owner name must be 1-20 characters long!' };
    
    // No invalid character restrictions – name is saved exactly as typed
    return { isValid: true, message: 'Valid owner name' };
}

// Common message context
const messageContext = {
    forwardingScore: 1,
    isForwarded: false,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '',
        newsletterName: '',
        serverMessageId: -1
    }
};

async function handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, currentPrefix) {
    const args = userMessage.split(' ').slice(1);
    const input = args.join(' ');
    const fake = createFakeContact(message);
    
    if (!message.key.fromMe && !(await isSudo(senderId))) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only bot owner can change the owner name!'
        }, { quoted: createFakeContact(message) });
        return;
    }

    if (!input) {
        const current = getOwnerName();
        await sock.sendMessage(chatId, { 
            text: `👑 Current Owner Name: *${current}*\n\nUsage: ${currentPrefix}setowner <new_name>\nExample: ${currentPrefix}setowner Supreme\nExample: ${currentPrefix}setowner john doe\n\nTo reset: ${currentPrefix}setowner reset`
        }, { quoted: createFakeContact(message) });
        return;
    }

    if (input.toLowerCase() === 'reset') {
        const success = resetOwnerName();
        const response = success ? 
            `✅ Owner name reset to default: *${DEFAULT_OWNER_NAME}*` : 
            '❌ Failed to reset owner name!';
        await sock.sendMessage(chatId, { text: response }, { quoted: createFakeContact(message) });
        return;
    }

    const validation = validateOwnerName(input);
    if (!validation.isValid) {
        await sock.sendMessage(chatId, { text: `❌ ${validation.message}` }, { quoted: createFakeContact(message) });
        return;
    }

    const success = setOwnerName(input); // saves raw input, no trimming
    const response = success ? 
        `✅ Owner name successfully set to: *${input}*` :  // shows raw input
        '❌ Failed to set owner name!';
    
    await sock.sendMessage(chatId, { text: response }, { quoted: createFakeContact(message) });
}

/**
 * Get owner info
 */
function getOwnerInfo() {
    const ownerName = getOwnerName();
    return {
        name: ownerName,
        formattedName: ownerName,
        isDefault: ownerName === DEFAULT_OWNER_NAME
    };
}

/**
 * Check if a given name matches the current owner name
 */
function isOwnerNameMatch(nameToCheck, caseSensitive = true) {
    const currentOwner = getOwnerName();
    return caseSensitive ? 
        currentOwner === nameToCheck : 
        currentOwner.toLowerCase() === nameToCheck.toLowerCase();
}

module.exports = {
    getOwnerName,
    setOwnerName,
    resetOwnerName,
    handleSetOwnerCommand,
    validateOwnerName,
    getOwnerInfo,
    isOwnerNameMatch,
    DEFAULT_OWNER_NAME
};
