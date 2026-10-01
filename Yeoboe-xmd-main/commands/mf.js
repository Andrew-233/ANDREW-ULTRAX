const axios = require('axios');
const cheerio = require('cheerio');

const { createFakeContact } = require('../lib/fakeContact');
async function MediaFire(url, options) {
    try {
        let mime;
        options = options ? options : {};
        const res = await axios.get(url, options);
        const $ = cheerio.load(res.data);
        const hasil = [];
        const link = $('a#downloadButton').attr('href');
        const size = $('a#downloadButton').text().replace('Download', '').replace('(', '').replace(')', '').replace('\n', '').replace('\n', '').replace('                         ', '');
        const seplit = link.split('/');
        const nama = seplit[5];
        mime = nama.split('.');
        mime = mime[1];
        hasil.push({ nama, mime, size, link });
        return hasil;
    } catch (err) {
        return err;
    }
}

async function mediafireCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, { 
            text: "↘️ Provide mediafire link...\n\nmediafire https://www.mediafire.com/file/...."
        }, { quoted: createFakeContact(message) });
    }

    if (!url.includes('mediafire.com')) {
        return sock.sendMessage(chatId, { 
            text: "That's not a mediafire link"
        }, { quoted: createFakeContact(message) });
    }

    try {
        const fileInfo = await MediaFire(url);

        if (!fileInfo || !fileInfo.length) {
            return sock.sendMessage(chatId, { 
                text: "File no longer available on MediaFire"
            }, { quoted: createFakeContact(message) });
        }

        await sock.sendMessage(chatId, {
            document: {
                url: fileInfo[0].link,
            },
            fileName: fileInfo[0].nama,
            mimetype: fileInfo[0].mime,
            caption: ``,
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("MediaFire Error:", error);
        await sock.sendMessage(chatId, { 
            text: "Failed to download file"
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = mediafireCommand;
