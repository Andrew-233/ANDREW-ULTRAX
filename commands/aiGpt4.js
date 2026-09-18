const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function gpt4Command(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '💭', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a question to ask GPT-4!\n\nExample: .gpt4 What is artificial intelligence?'
            }, { quoted: createFakeContact(message) });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Question too long! Max 1000 characters.'
            }, { quoted: createFakeContact(message) });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response
        const apiUrl = `https://meta-api.zone.id/ai/chatgptfree?prompt=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        // Validate API response
        if (!apiData || typeof apiData !== 'object') {
            throw new Error("Invalid API response format!");
        }

        // Check for response in different possible fields
        let aiResponse = '';
        
        // Try different possible response fields
        if (apiData.answer && typeof apiData.answer === 'string') {
            aiResponse = apiData.answer.trim();
        } else if (apiData.response && typeof apiData.response === 'string') {
            aiResponse = apiData.response.trim();
        } else if (apiData.message && typeof apiData.message === 'string') {
            aiResponse = apiData.message.trim();
        } else if (apiData.text && typeof apiData.text === 'string') {
            aiResponse = apiData.text.trim();
        } else if (apiData.data && typeof apiData.data === 'string') {
            aiResponse = apiData.data.trim();
        } else if (apiData.content && typeof apiData.content === 'string') {
            aiResponse = apiData.content.trim();
        } else if (typeof apiData === 'string') {
            aiResponse = apiData.trim();
        } else {
            // Try to extract any string value from the response
            for (const key in apiData) {
                if (typeof apiData[key] === 'string' && apiData[key].trim().length > 0) {
                    aiResponse = apiData[key].trim();
                    break;
                }
            }
        }

        // If still no response, check for nested structure
        if (!aiResponse && apiData.data && typeof apiData.data === 'object') {
            for (const key in apiData.data) {
                if (typeof apiData.data[key] === 'string' && apiData.data[key].trim().length > 0) {
                    aiResponse = apiData.data[key].trim();
                    break;
                }
            }
        }

        // If no valid response found
        if (!aiResponse || aiResponse.length === 0) {
            console.log("API Response structure:", JSON.stringify(apiData, null, 2));
            throw new Error("API returned empty or invalid response!");
        }

        // Limit response length to prevent WhatsApp issues
        if (aiResponse.length > 4000) {
            aiResponse = aiResponse.substring(0, 4000) + "...\n\n(Response truncated due to length limits)";
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        await sock.sendMessage(chatId, {
            text: `🤔 *GPT-4*\n\n📝 *Question:* ${query}\n\n💬 *Response:* ${aiResponse}\n\n📊 *Powered by OpenAI & Gpt-4*`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("GPT-4 command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage = 'An error occurred while processing your request.';
        
        if (error.response) {
            // Server responded with error status
            if (error.response.status === 404) {
                errorMessage = 'API endpoint not found! The service may be temporarily unavailable.';
            } else if (error.response.status === 429) {
                errorMessage = 'Too many requests! Please try again later.';
            } else if (error.response.status >= 500) {
                errorMessage = 'Server error! The AI service is having issues.';
            } else {
                errorMessage = `API Error: ${error.response.status}`;
            }
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out! The AI is taking too long to respond.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to AI service! Check your internet connection.';
        } else if (error.message.includes('Cannot read properties of undefined')) {
            errorMessage = 'The AI service returned an unexpected response format.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = gpt4Command;
