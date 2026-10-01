function createFakeContact(message) {
    const { getBotName } = require('./botConfig');
    const jid = message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0';
    return {
        key: {
            participants: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast',
            fromMe: false,
            id: getBotName()
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${getBotName()}\nitem1.TEL;waid=${jid}:${jid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: '0@s.whatsapp.net'
    };
}

module.exports = { createFakeContact };
