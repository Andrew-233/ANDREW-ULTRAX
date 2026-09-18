const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function demoteCommand(sock, chatId, mentionedJids, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: 'This command can only be used in groups!'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isSudo(senderId);
        if (!isOwner) {
            try {
                const adminStatus = await isAdmin(sock, chatId, senderId);
                
                if (!adminStatus.isBotAdmin) {
                    await sock.sendMessage(chatId, { 
                        text: ' Please make the bot an admin first to use this command.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }

                if (!adminStatus.isSenderAdmin) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Error: Only group admins can use the demote command.'
                    }, { quoted: createFakeContact(message) });
                    return;
                }
            } catch (adminError) {
                console.error('Error checking admin status:', adminError);
                await sock.sendMessage(chatId, { 
                    text: ' Please make sure the bot is an admin of this group.'
                }, { quoted: createFakeContact(message) });
                return;
            }
        }

        let userToDemote = [];
        
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }
        
        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'Please mention the user or reply to their message to demote!'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Normalize bot JID (strip device suffix if present)
        const botJid = sock.user.id.split(':')[0];

        
        // Filter out the bot from the demotion list
        const filteredUsersToDemote = userToDemote.filter(jid => {
            const cleanJid = jid.split(':')[0];
            return cleanJid !== botJid;
        });
        
        if (filteredUsersToDemote.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'You cannot demote the bot itself!'
            }, { quoted: createFakeContact(message) });
            return;
        }

        const wasBotIncluded = userToDemote.length > filteredUsersToDemote.length;
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        await sock.groupParticipantsUpdate(chatId, filteredUsersToDemote, "demote");
        
        const usernames = await Promise.all(filteredUsersToDemote.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));

        await new Promise(resolve => setTimeout(resolve, 1000));

        let demotionMessage = `Demoted: ${usernames.join(', ')}`;
        
        if (wasBotIncluded) {
            demotionMessage += '\n⚠️ Note: The bot cannot demote itself.';
        }
        
        await sock.sendMessage(chatId, { 
            text: demotionMessage,
            mentions: filteredUsersToDemote
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in demote command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: '❌ Rate limit reached. Please try again in a few seconds.'
                }, { quoted: createFakeContact(message) });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to demote user(s). Make sure the bot is admin and has sufficient permissions.'
                }, { quoted: createFakeContact(message) });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

async function handleDemotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }

        // Normalize bot JID
        const botJid = sock.user.id.split(':')[0];
        
        // Filter out the bot from participants list to prevent self-demotion
        const filteredParticipants = participants.filter(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            const cleanJid = jidString.split(':')[0];
            return cleanJid !== botJid;
        });

        if (filteredParticipants.length === 0) {
            console.log('No valid participants to demote (bot was only participant)');
            return;
        }

        const isBotAction = author && author.length > 0 && 
                           (author === botJid || author.includes(botJid));

        if (!isBotAction) {
            console.log('Demotion not performed by bot, skipping notification');
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotedUsernames = await Promise.all(filteredParticipants.map(async jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }));

        let mentionList = filteredParticipants.map(jid => {
            return typeof jid === 'string' ? jid : (jid.id || jid.toString());
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotionMessage = `Demoted: ${demotedUsernames.join(', ')}`;
        
        await sock.sendMessage(groupId, {
            text: demotionMessage,
            mentions: mentionList
        }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error handling demotion event:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

module.exports = { demoteCommand, handleDemotionEvent };
