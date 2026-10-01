const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function speechwriterCommand(sock, chatId, message) {
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '📥', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a topic for speech writing!\n\nExample: .speechwriter how to pass exams\n\nYou can also use: .speech or .writer'
            }, { quoted: createFakeContact(message) });
        }

        const parts = text.split(' ');
        const topic = parts.slice(1).join(' ').trim();

        if (!topic) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a topic for speech writing!\n\nExample: .speechwriter how to pass exams'
            }, { quoted: createFakeContact(message) });
        }

        if (topic.length > 200) {
            return await sock.sendMessage(chatId, {
                text: '📝 Topic too long! Max 200 characters.'
            }, { quoted: createFakeContact(message) });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Default parameters
        const length = "short";
        const type = "dedication";
        const tone = "serious";

        // Build API URL with parameters
        const apiUrl = `https://apiskeith.top/ai/speechwriter?topic=${encodeURIComponent(topic)}&length=${length}&type=${type}&tone=${tone}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        // Validate response structure
        if (!apiData?.status || !apiData?.result?.data?.data?.speech) {
            throw new Error("Speechwriter API returned an invalid response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send the speech
        const speech = apiData.result.data.data.speech.trim();
        
        await sock.sendMessage(chatId, {
            text: `🎤 *Speech Writer Assistant*\n\n📝 *Topic:* ${topic}\n\n💬 *Generated Speech:*\n\n${speech}\n\n━━━━━━━━━━━━━━━━━━━━\n📋 *Details:*\n• Length: ${length}\n• Type: ${type}\n• Tone: ${tone}\n\n> *Powered by Keith's Speechwriter API*`
        }, { quoted: createFakeContact(message) });

        // Send final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📤', key: message.key }
        });

    } catch (error) {
        console.error("Speechwriter command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Speechwriter API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to Speechwriter service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests! Please try again later.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Speechwriter service is currently unavailable.';
        } else if (error.message.includes('invalid response')) {
            errorMessage = 'Speechwriter API returned an invalid response format.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = speechwriterCommand;
