const fetch = require('node-fetch');

const { createFakeContact } = require('../lib/fakeContact');
module.exports = async function quoteCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const res = await fetch(`https://shizoapi.onrender.com/api/texts/quotes?apikey=${shizokeys}`);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const quoteMessage = json.result;

        // Send the quote message
        await sock.sendMessage(chatId, { text: quoteMessage }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in quote command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get quote. Please try again later!' }, { quoted: createFakeContact(message) });
    }
};
