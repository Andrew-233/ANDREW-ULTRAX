const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');

const { createFakeContact } = require('../lib/fakeContact');

async function githubCommand(sock, chatId, message) {
    try {
        const fkontak = createFakeContact(message);

        const senderJid = (message.key.participant || message.key.remoteJid || '').replace(/:\d+/, '');
        const senderPhone = senderJid.split('@')[0];
        const pushname = message.pushName || 'User';

        const res = await fetch(settings.repositoryApiUrl);
        if (!res.ok) throw new Error('Error fetching repository data');
        const json = await res.json();

        let txt = `🔸  \`𝚁𝙴𝙿𝙾 𝙸𝙽𝙵𝙾🔸\` \n\n`;
        txt += `🔹  *Name* : ${json.name}\n`;
        txt += `🔹  *Watchers* : ${json.watchers_count}\n`;
        txt += `🔹  *Size* : ${(json.size / 1024).toFixed(2)} MB\n`;
        txt += `🔹  *Last Updated* : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}\n`;
        txt += `🔹  *REPO* : ${json.html_url}\n\n`;
        txt += `🔹  *Forks* : ${json.forks_count}\n`;
        txt += `🔹  *Stars* : ${json.stargazers_count}\n`;
        txt += `🔹  *Desc* : ${json.description || 'None'}\n\n`;
        txt += `Hey👋 @${senderPhone} \n Thank you for CHOOSING, fork and Star the repository_`;

        const imgPath = path.join(__dirname, '../assets/repo.jpg');
        const imgBuffer = fs.readFileSync(imgPath);

        await sock.sendMessage(chatId, {
            image: imgBuffer,
            caption: txt,
            mentions: [senderJid],
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: settings.newsletterJid,
                    newsletterName: settings.newsletterName,
                    serverMessageId: -1
                }
            }
        }, { quoted: fkontak });

        await sock.sendMessage(chatId, {
            react: { text: '✔️', key: message.key }
        });

    } catch (error) {
        await sock.sendMessage(chatId, {
            text: '❌ Error fetching repository information.'
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = githubCommand;
