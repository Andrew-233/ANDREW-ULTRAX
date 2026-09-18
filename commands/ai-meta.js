const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function metaiCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '⤵️', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query for Meta AI!\n\nExample: .metai What is artificial intelligence?'
            }, { quoted: createFakeContact(message) });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query for Meta AI!\n\nExample: .metai What is artificial intelligence?'
            }, { quoted: createFakeContact(message) });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Query too long! Max 1000 characters.'
            }, { quoted: createFakeContact(message) });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response using Meta AI API
        const apiUrl = `https://apiskeith.top/ai/metai?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result) {
            throw new Error("API failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        const aiResponse = apiData.result.trim();
        
        await sock.sendMessage(chatId, {
            text: `🤖 *Meta AI Assistant*\n\n📝 *Query:* ${query}\n\n💬 *Response:*\n ${aiResponse}\n\n> *Powered by Meta AI*`
        }, { quoted: createFakeContact(message) });

      // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '📤', key: message.key }
        });

    } catch (error) {
        console.error("Meta AI command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to AI service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests! Please try again later.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Meta AI service is currently unavailable.';
        } else if (error.message.includes('API failed')) {
            errorMessage = 'Meta AI failed to generate a response.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = metaiCommand;
