const { createFakeContact } = require('../lib/fakeContact');
async function chaneljidCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, { 
            text: 'Example: chjid https://whatsapp.com/chanel/...'
        }, { quoted: createFakeContact(message) });
    }

    if (!url.includes("https://whatsapp.com/channel/")) {
        return sock.sendMessage(chatId, { 
            text: 'Invalid WhatsApp channel link'
        }, { quoted: createFakeContact(message) });
    }

    try {
        const result = url.split('https://whatsapp.com/channel/')[1];
        const res = await sock.newsletterMetadata("invite", result);

        const info = `ID: ${res.id}\nName: ${res.name}\nFollower: ${res.subscribers}\nStatus: ${res.state}\nVerified: ${res.verification === "VERIFIED" ? "Yes" : "No"}`;
        
               await sock.sendMessage(chatId, { 
            text: `${res.id}`
        }, { quoted: createFakeContact(message) });
        

    } catch (error) {
        console.error('ChannelJID Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to get channel info'
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = { chaneljidCommand };
