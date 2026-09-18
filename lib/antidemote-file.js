const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'antidemote.json');
const HISTORY_FILE = path.join(DATA_DIR, 'antidemote-history.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(DATA_FILE, '{}');
        await fs.writeFile(HISTORY_FILE, '{}');
    }
}

// ============ MAIN CONFIG FUNCTIONS ============

async function setAntidemote(chatId, status, userId = null) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        // Store previous state for revert
        const previousState = data[chatId] ? { ...data[chatId] } : null;
        
        data[chatId] = {
            enabled: status === 'on',
            status: status,
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
            kickCount: data[chatId]?.kickCount || 0,
            protectedCount: data[chatId]?.protectedCount || 0,
            kickRecords: data[chatId]?.kickRecords || [],
            bannedUsers: data[chatId]?.bannedUsers || []
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Log action for revert
        await addToHistory(chatId, {
            action: status === 'on' ? 'enable' : 'disable',
            previousState: previousState,
            newState: data[chatId],
            timestamp: new Date().toISOString(),
            userId: userId
        });
        
        return data[chatId];
    } catch (error) {
        console.error('Error in setAntidemote:', error);
        throw error;
    }
}

async function getAntidemote(chatId) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        if (data[chatId]) {
            return {
                chatId,
                ...data[chatId],
                enabled: data[chatId].enabled || data[chatId].status === 'on'
            };
        }
        return { 
            chatId, 
            enabled: false, 
            status: 'off', 
            updatedAt: null,
            kickCount: 0,
            protectedCount: 0,
            kickRecords: [],
            bannedUsers: []
        };
    } catch (error) {
        console.error('Error in getAntidemote:', error);
        return { 
            chatId, 
            enabled: false, 
            status: 'off', 
            updatedAt: null,
            kickCount: 0,
            protectedCount: 0,
            kickRecords: [],
            bannedUsers: []
        };
    }
}

async function removeAntidemote(chatId, userId = null) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        // Store for revert
        const previousState = data[chatId] ? { ...data[chatId] } : null;
        
        if (data[chatId]) {
            delete data[chatId];
            await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
            
            // Log removal for revert
            await addToHistory(chatId, {
                action: 'remove',
                previousState: previousState,
                newState: null,
                timestamp: new Date().toISOString(),
                userId: userId
            });
        }
        return true;
    } catch (error) {
        console.error('Error in removeAntidemote:', error);
        throw error;
    }
}

// ============ HISTORY / REVERT FUNCTIONS ============

async function addToHistory(chatId, entry) {
    try {
        const history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8').catch(() => '{}'));
        
        if (!history[chatId]) {
            history[chatId] = [];
        }
        
        // Keep last 10 actions per chat
        history[chatId].unshift(entry);
        if (history[chatId].length > 10) {
            history[chatId] = history[chatId].slice(0, 10);
        }
        
        await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (error) {
        console.error('Error adding to history:', error);
        return false;
    }
}

async function getLastAction(chatId) {
    try {
        const history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8').catch(() => '{}'));
        return history[chatId]?.[0] || null;
    } catch (error) {
        console.error('Error getting last action:', error);
        return null;
    }
}

async function revertLastAction(chatId) {
    await ensureDataDir();
    try {
        const lastAction = await getLastAction(chatId);
        
        if (!lastAction) {
            return { success: false, message: 'No actions to revert' };
        }
        
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        switch (lastAction.action) {
            case 'enable':
            case 'disable':
                // Revert to previous state
                if (lastAction.previousState) {
                    data[chatId] = lastAction.previousState;
                } else {
                    delete data[chatId];
                }
                break;
                
            case 'remove':
                // Restore removed config
                if (lastAction.previousState) {
                    data[chatId] = lastAction.previousState;
                }
                break;
                
            case 'kick':
                return { success: false, message: 'Cannot revert kick action automatically' };
                
            default:
                return { success: false, message: 'Cannot revert this action' };
        }
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Remove reverted action from history
        const history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8').catch(() => '{}'));
        if (history[chatId]) {
            history[chatId].shift();
            await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        }
        
        return { 
            success: true, 
            message: `✅ Successfully reverted ${lastAction.action} action`,
            revertedAction: lastAction 
        };
    } catch (error) {
        console.error('Error reverting action:', error);
        return { success: false, message: '❌ Error reverting action' };
    }
}

// ============ KICK TRACKING FUNCTIONS ============

async function addKickRecord(chatId, kickedUser, kickedBy, reason = 'manual') {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (!data[chatId]) {
            data[chatId] = { 
                enabled: false, 
                status: 'off', 
                kickRecords: [],
                kickCount: 0,
                protectedCount: 0,
                bannedUsers: []
            };
        }
        
        if (!data[chatId].kickRecords) {
            data[chatId].kickRecords = [];
        }
        
        const kickRecord = {
            userId: kickedUser,
            kickedBy: kickedBy,
            reason: reason,
            timestamp: new Date().toISOString(),
            repromoted: reason === 'demote'
        };
        
        data[chatId].kickRecords.unshift(kickRecord);
        
        // Keep last 20 kick records
        if (data[chatId].kickRecords.length > 20) {
            data[chatId].kickRecords = data[chatId].kickRecords.slice(0, 20);
        }
        
        // Update kick count
        data[chatId].kickCount = (data[chatId].kickCount || 0) + 1;
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Log to history
        await addToHistory(chatId, {
            action: 'kick',
            kickedUser,
            kickedBy,
            reason,
            timestamp: new Date().toISOString()
        });
        
        return kickRecord;
    } catch (error) {
        console.error('Error adding kick record:', error);
        return null;
    }
}

async function getKickStats(chatId) {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (!data[chatId]) {
            return {
                totalKicks: 0,
                recentKicks: [],
                protectedCount: 0
            };
        }
        
        return {
            totalKicks: data[chatId].kickCount || 0,
            recentKicks: data[chatId].kickRecords || [],
            protectedCount: data[chatId].protectedCount || 0
        };
    } catch (error) {
        console.error('Error getting kick stats:', error);
        return { totalKicks: 0, recentKicks: [], protectedCount: 0 };
    }
}

async function incrementProtectedCount(chatId) {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (data[chatId]) {
            data[chatId].protectedCount = (data[chatId].protectedCount || 0) + 1;
            await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        }
        
        return true;
    } catch (error) {
        console.error('Error incrementing protected count:', error);
        return false;
    }
}

// ============ BANNED USERS TRACKING ============

async function addBannedUser(chatId, userId, bannedBy, reason = 'manual') {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (!data[chatId]) {
            data[chatId] = { 
                enabled: false, 
                status: 'off', 
                bannedUsers: [],
                kickRecords: [],
                kickCount: 0,
                protectedCount: 0
            };
        }
        
        if (!data[chatId].bannedUsers) {
            data[chatId].bannedUsers = [];
        }
        
        const banRecord = {
            userId,
            bannedBy,
            reason,
            timestamp: new Date().toISOString(),
            active: true
        };
        
        // Check if already banned
        const existingBanIndex = data[chatId].bannedUsers.findIndex(b => b.userId === userId && b.active);
        if (existingBanIndex !== -1) {
            data[chatId].bannedUsers[existingBanIndex] = banRecord;
        } else {
            data[chatId].bannedUsers.push(banRecord);
        }
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        await addToHistory(chatId, {
            action: 'ban',
            userId,
            bannedBy,
            reason,
            timestamp: new Date().toISOString()
        });
        
        return banRecord;
    } catch (error) {
        console.error('Error adding banned user:', error);
        return null;
    }
}

async function removeBannedUser(chatId, userId) {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (data[chatId]?.bannedUsers) {
            const banIndex = data[chatId].bannedUsers.findIndex(b => b.userId === userId && b.active);
            if (banIndex !== -1) {
                data[chatId].bannedUsers[banIndex].active = false;
                data[chatId].bannedUsers[banIndex].removedAt = new Date().toISOString();
                await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
                
                await addToHistory(chatId, {
                    action: 'unban',
                    userId,
                    timestamp: new Date().toISOString()
                });
                
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error removing banned user:', error);
        return false;
    }
}

async function isUserBanned(chatId, userId) {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        
        if (data[chatId]?.bannedUsers) {
            return data[chatId].bannedUsers.some(b => b.userId === userId && b.active);
        }
        return false;
    } catch (error) {
        console.error('Error checking banned user:', error);
        return false;
    }
}

module.exports = {
    setAntidemote,
    getAntidemote,
    removeAntidemote,
    revertLastAction,
    getLastAction,
    addKickRecord,
    getKickStats,
    incrementProtectedCount,
    addBannedUser,
    removeBannedUser,
    isUserBanned,
    ensureDataDir
};
