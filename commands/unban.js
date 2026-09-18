const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');
const { isSudo } = require('../lib/index');

const { createFakeContact } = require('../lib/fakeContact');
async function unbanCommand(sock, chatId, message) {
    // Only bot owner/sudo can use this command
    const senderId = message.key.participant || message.key.remoteJid;
    const senderIsSudo = await isSudo(senderId);
    
    if (!message.key.fromMe && !senderIsSudo) {
        return;
    }

    let userToUnban;
    
    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToUnban = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToUnban = message.message.extendedTextMessage.contextInfo.participant;
    }
    // Check if user ID is provided as argument
    else {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ').slice(1);
        if (args.length > 0) {
            // Try to extract JID from argument
            const possibleJid = args[0];
            if (possibleJid.includes('@')) {
                userToUnban = possibleJid;
            } else {
                // Assume it's a phone number, add @s.whatsapp.net
                userToUnban = possibleJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }
        }
    }
    
    if (!userToUnban) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention the user, reply to their message, or provide their JID/phone number!\nExample: .unban @user or .unban 6281234567890', 
            ...channelInfo 
        }, { quoted: createFakeContact(message) });
        return;
    }

    try {
        const bannedUsers = JSON.parse(fs.readFileSync('./data/banned.json'));
        const index = bannedUsers.indexOf(userToUnban);
        if (index > -1) {
            bannedUsers.splice(index, 1);
            fs.writeFileSync('./data/banned.json', JSON.stringify(bannedUsers, null, 2));
            
            await sock.sendMessage(chatId, { 
                text: `✅ Successfully unbanned ${userToUnban.split('@')[0]}!`,
                mentions: [userToUnban],
                ...channelInfo 
            }, { quoted: createFakeContact(message) });
        } else {
            await sock.sendMessage(chatId, { 
                text: `❌ ${userToUnban.split('@')[0]} is not banned!`,
                mentions: [userToUnban],
                ...channelInfo 
            }, { quoted: createFakeContact(message) });
        }
    } catch (error) {
        console.error('Error in unban command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to unban user!', ...channelInfo }, { quoted: createFakeContact(message) });
    }
}

module.exports = unbanCommand;
