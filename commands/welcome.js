const { isWelcomeOn, getWelcome, handleWelcome, isWelcomeNoPic } = require('../lib/welcome');
const { channelInfo } = require('../lib/messageConfig');
const fetch = require('node-fetch');
const { normalizeJid, findParticipant } = require('../lib/jid');
const { getBotName } = require('../lib/botConfig');

async function welcomeCommand(sock, chatId, message) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: message });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants, message) {
    // Check if welcome is enabled for this group
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    // Get custom welcome message
    const customMessage = await getWelcome(id);

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';
    const membersCount = groupMetadata.participants.length;

    // Send welcome message for each new participant
    for (const participant of participants) {
        try {
            const participantString = normalizeJid(typeof participant === 'string' ? participant : (participant.id || participant.toString()));
            const user = participantString.split('@')[0];
            
            let displayName = user;
            try {
                const found = findParticipant(groupMetadata.participants, participantString);
                if (found && found.name) {
                    displayName = found.name;
                }
            } catch {
                console.log('Could not fetch display name, using phone number');
            }

            // Check nopic setting for this group
            const noPic = await isWelcomeNoPic(id);

            // Get user profile picture (only when nopic is off)
            let profilePicUrl = '';
            let profilePicBuffer = null;
            if (!noPic) {
                try {
                    profilePicUrl = await sock.profilePictureUrl(participantString, 'image');
                    const picResponse = await fetch(profilePicUrl);
                    if (picResponse.ok) {
                        profilePicBuffer = await picResponse.buffer();
                    }
                } catch {
                    console.log('No profile picture available for user:', displayName);
                    profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
                    const defaultResponse = await fetch(profilePicUrl);
                    if (defaultResponse.ok) {
                        profilePicBuffer = await defaultResponse.buffer();
                    }
                }
            }
            
            // Process custom message with variables
            let finalMessage;
            if (customMessage) {
                finalMessage = customMessage
                    .replace(/{user}/g, `@${displayName}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc)
                    .replace(/{bot}/g, getBotName())
                    .replace(/{members}/g, membersCount.toString());
            } else {
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    timeZone: 'Africa/Nairobi',
                    month: '2-digit',
                    day: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
                
                finalMessage = `╭╼━≪•NEW-MEMBER•≫━╾╮
┃WELCOME: @${displayName} 👋
┃Member count: #${membersCount}
┃𝚃𝙸𝙼𝙴: ${timeString}⏰
╰━━━━━━━━━━━━━━━╯

*@${displayName}* Welcome to *${groupName}*! 🎉
*𝙳𝙴𝚂𝙲𝙸𝙿𝚃𝙸𝙾𝙽*
${groupDesc}

🤖 Powered by ${getBotName()}`;
            }
            
            // Send message — text only if nopic is on, otherwise try with image
            if (noPic) {
                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString],
                    ...channelInfo
                }, { quoted: message });
            } else {
                try {
                    if (profilePicBuffer) {
                        await sock.sendMessage(id, {
                            image: profilePicBuffer,
                            caption: finalMessage,
                            mentions: [participantString],
                            ...channelInfo
                        }, { quoted: message });
                    } else {
                        const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${membersCount}&avatar=${encodeURIComponent(profilePicUrl || 'https://img.pyrocdn.com/dbKUgahg.png')}`;
                        
                        const response = await fetch(apiUrl);
                        if (response.ok) {
                            const imageBuffer = await response.buffer();
                            await sock.sendMessage(id, {
                                image: imageBuffer,
                                caption: finalMessage,
                                mentions: [participantString],
                                ...channelInfo
                            }, { quoted: message });
                        } else {
                            throw new Error('API image generation failed');
                        }
                    }
                } catch {
                    console.log('Image sending failed, falling back to text');
                    await sock.sendMessage(id, {
                        text: finalMessage,
                        mentions: [participantString],
                        ...channelInfo
                    }, { quoted: message });
                }
            }
        } catch (error) {
            console.error('Error sending welcome message:', error);
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const user = participantString.split('@')[0];
            
            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc)
                    .replace(/{bot}/g, getBotName())
                    .replace(/{members}/g, membersCount.toString());
            } else {
                fallbackMessage = `Welcome @${user} to ${groupName}! 🎉 Powered by ${getBotName()}. We now have ${membersCount} members.`;
            }
            
            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions: [participantString],
                ...channelInfo
            }, { quoted: message });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
