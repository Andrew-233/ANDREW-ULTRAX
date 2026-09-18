const { isGoodByeOn, getGoodbye, handleGoodbye, isGoodbyeNoPic } = require('../lib/welcome');
const fetch = require('node-fetch');
const { normalizeJid, findParticipant } = require('../lib/jid');
const { getBotName } = require('../lib/botConfig');

async function goodbyeCommand(sock, chatId, message, match) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: message });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

async function handleLeaveEvent(sock, id, participants, message) {
    // Check if goodbye is enabled for this group
    const isGoodbyeEnabled = await isGoodByeOn(id);
    if (!isGoodbyeEnabled) return;

    // Get custom goodbye message
    const customMessage = await getGoodbye(id);

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const membersCount = groupMetadata.participants.length;

    // Send goodbye message for each leaving participant
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
            const noPic = await isGoodbyeNoPic(id);

            // Process custom message with variables
            let finalMessage;
            if (customMessage) {
                finalMessage = customMessage
                    .replace(/{user}/g, `@${displayName}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{bot}/g, getBotName())
                    .replace(/{members}/g, membersCount.toString());
            } else {
                finalMessage = `Goodbye @${displayName} from ${groupName}! 👋\nWe now have ${membersCount} members.\n🤖 Powered by ${getBotName()}`;
            }

            // Send message — text only if nopic is on, otherwise try with image
            if (noPic) {
                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString]
                }, { quoted: message });
            } else {
                try {
                    let profilePicUrl;
                    try {
                        profilePicUrl = await sock.profilePictureUrl(participantString, 'image');
                    } catch {
                        console.log('No profile picture available, using default');
                        profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
                    }
                    
                    const picResponse = await fetch(profilePicUrl);
                    if (picResponse.ok) {
                        const imageBuffer = await picResponse.buffer();
                        await sock.sendMessage(id, {
                            image: imageBuffer,
                            caption: finalMessage,
                            mentions: [participantString]
                        }, { quoted: message });
                        continue;
                    }
                } catch (imageError) {
                    console.log('Failed to send profile picture, falling back to text', imageError);
                }

                // Fallback to text message if image fails
                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString]
                }, { quoted: message });
            }
        } catch (error) {
            console.error('Error sending goodbye message:', error);
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const user = participantString.split('@')[0];
            
            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{bot}/g, getBotName())
                    .replace(/{members}/g, membersCount.toString());
            } else {
                fallbackMessage = `Goodbye @${user}! 👋 Powered by ${getBotName()}. We now have ${membersCount} members.`;
            }
            
            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions: [participantString]
            }, { quoted: message });
        }
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
