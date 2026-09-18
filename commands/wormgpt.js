const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function wormgptCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';
        
        const used = (rawText || '').split(/\s+/)[0] || '.wormgpt';
        const query = rawText.slice(used.length).trim();
        
        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .wormgpt <your query>'
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        });

        // Call WormGPT API
        const apiUrl = `https://apiskeith.top/ai/wormgpt?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: { 
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json'
            } 
        });

        if (!data?.status || !data?.result) {
            throw new Error(data?.error || 'Invalid response from WormGPT API');
        }

        // Processing reaction
        await sock.sendMessage(chatId, {
            react: { text: '👿', key: message.key }
        });

        // Send only the result
        await sock.sendMessage(chatId, { 
            text: data.result 
        }, { quoted: createFakeContact(message) });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '🧬', key: message.key }
        });

    } catch (error) {
        console.error('[WORMGPT] error:', error?.message || error);
        
        let errorMsg = error?.response?.data?.message || error?.message || error?.response?.data?.error || 'Unknown error occurred';

        // Error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        await sock.sendMessage(chatId, { 
            text: `❌ Failed to get WormGPT response\n\nError: ${errorMsg}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = wormgptCommand;
