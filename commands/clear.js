const { createFakeContact } = require('../lib/fakeContact');
async function clearCommand(sock, chatId, isGroup = false, numberOfMessages = 50) {
    try {
        // Send initial notification
        const notification = await sock.sendMessage(chatId, { 
            text: `🗑️ Clearing ${numberOfMessages} messages...` 
        }, { quoted: createFakeContact(message) });

        let messagesDeleted = 0;
        
        if (isGroup) {
            // For group chats - clear bot messages and command messages
            messagesDeleted = await clearGroupMessages(sock, chatId, numberOfMessages);
        } else {
            // For private chats - clear recent messages
            messagesDeleted = await clearPrivateMessages(sock, chatId, numberOfMessages);
        }

        // Update notification with result
        await sock.sendMessage(chatId, { 
            text: `✅ Successfully cleared ${messagesDeleted} messages!`,
            edit: notification.key 
        });

        // Auto-delete the success message after 3 seconds
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { 
                    delete: notification.key 
                }, { quoted: createFakeContact(message) });
            } catch (error) {
                console.log('Failed to auto-delete notification:', error);
            }
        }, 3000);

    } catch (error) {
        console.error('Error clearing messages:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while clearing messages.' 
        }, { quoted: createFakeContact(message) });
    }
}

// Helper function for group messages
async function clearGroupMessages(sock, chatId, limit) {
    let deletedCount = 0;
    
    try {
        // Get recent messages in the group
        const messages = await sock.fetchMessagesFromWA(chatId, limit);
        
        for (const message of messages) {
            try {
                // Delete messages sent by the bot or command messages
                if (message.key.fromMe || 
                    (message.message?.conversation && 
                     message.message.conversation.startsWith('!clear'))) {
                    
                    await sock.sendMessage(chatId, { 
                        delete: message.key 
                    }, { quoted: createFakeContact(message) });
                    deletedCount++;
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (msgError) {
                console.log(`Failed to delete message: ${message.key.id}`);
            }
        }
    } catch (error) {
        console.error('Error in clearGroupMessages:', error);
    }
    
    return deletedCount;
}

// Helper function for private messages
async function clearPrivateMessages(sock, chatId, limit) {
    let deletedCount = 0;
    
    try {
        // Get recent messages in private chat
        const messages = await sock.fetchMessagesFromWA(chatId, limit);
        
        for (const message of messages) {
            try {
                // In private chats, we can delete our own messages
                if (message.key.fromMe) {
                    await sock.sendMessage(chatId, { 
                        delete: message.key 
                    }, { quoted: createFakeContact(message) });
                    deletedCount++;
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (msgError) {
                console.log(`Failed to delete message: ${message.key.id}`);
            }
        }
    } catch (error) {
        console.error('Error in clearPrivateMessages:', error);
    }
    
    return deletedCount;
}

// Alternative function to clear all messages (more aggressive)
async function clearAllMessages(sock, chatId, isGroup = false) {
    try {
        const notification = await sock.sendMessage(chatId, { 
            text: '🧹 Clearing all clearable messages...' 
        }, { quoted: createFakeContact(message) });

        let totalDeleted = 0;
        const batchSize = 50;
        let hasMoreMessages = true;

        while (hasMoreMessages && totalDeleted < 1000) { // Safety limit
            const messages = await sock.fetchMessagesFromWA(chatId, batchSize);
            
            if (messages.length === 0) {
                hasMoreMessages = false;
                break;
            }

            let batchDeleted = 0;
            for (const message of messages) {
                try {
                    if (message.key.fromMe) {
                        await sock.sendMessage(chatId, { 
                            delete: message.key 
                        }, { quoted: createFakeContact(message) });
                        batchDeleted++;
                        totalDeleted++;

                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.log(`Failed to delete message: ${message.key.id}`);
                }
            }

            // If we didn't delete any messages in this batch, stop
            if (batchDeleted === 0) {
                hasMoreMessages = false;
            }
        }

        await sock.sendMessage(chatId, { 
            text: `✅ Cleared ${totalDeleted} messages total!`,
            edit: notification.key 
        });

        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { 
                    delete: notification.key 
                }, { quoted: createFakeContact(message) });
            } catch (error) {
                console.log('Failed to auto-delete notification');
            }
        }, 3000);

    } catch (error) {
        console.error('Error in clearAllMessages:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error clearing all messages.' 
        }, { quoted: createFakeContact(message) });
    }
}

// Enhanced command handler with parameters
async function handleClearCommand(sock, chatId, message, args) {
    const isGroup = chatId.endsWith('@g.us');
    
    // Parse arguments
    if (args.includes('all')) {
        return await clearAllMessages(sock, chatId, isGroup);
    }
    
    const countMatch = args.find(arg => !isNaN(parseInt(arg)));
    const messageCount = countMatch ? parseInt(countMatch) : 50;
    
    // Limit for safety
    const safeCount = Math.min(messageCount, 200);
    
    return await clearCommand(sock, chatId, isGroup, safeCount);
}

module.exports = { 
    clearCommand, 
    clearAllMessages, 
    handleClearCommand 
};
