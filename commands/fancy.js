const axios = require('axios');
const { BASE_API } = require('../lib/apiConfig');
const { createFakeContact } = require('../lib/fakeContact');

const replyHandlers = new Map();

async function fancyCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '✨', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        let query;
        if (text && text.startsWith('.fancy ')) {
            query = text.slice(7).trim();
        } else if (quoted) {
            query = quoted.conversation || quoted.extendedTextMessage?.text;
            if (!query) return await sock.sendMessage(chatId, {
                text: '❌ Could not extract quoted text.'
            }, { quoted: createFakeContact(message) });
        } else {
            return await sock.sendMessage(chatId, {
                text: '📌 Provide text or reply to a message.\nExample: .fancy Hello'
            }, { quoted: createFakeContact(message) });
        }

        if (!query) return await sock.sendMessage(chatId, {
            text: '📌 Please provide text to convert to fancy style!'
        }, { quoted: createFakeContact(message) });

        if (query.length > 200) return await sock.sendMessage(chatId, {
            text: '📝 Text too long! Max 200 characters.'
        }, { quoted: createFakeContact(message) });

        const stylesUrl = `${BASE_API}/fancytext/styles?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(stylesUrl, { timeout: 30000 });

        if (!data || !Array.isArray(data.styles)) {
            return await sock.sendMessage(chatId, {
                text: '❌ Failed to fetch fancy styles.'
            }, { quoted: createFakeContact(message) });
        }

        let caption = `✨ *Fancy styles for:* ${data.input || query}\n\n`;
        data.styles.forEach((style, i) => {
            caption += `*${i + 1}.* [${style.name}]\n${style.result}\n\n`;
        });
        caption += `📌 Reply with a style number to get just that style.`;

        const sent = await sock.sendMessage(chatId, { text: caption }, { quoted: createFakeContact(message) });
        const messageId = sent.key.id;

        replyHandlers.set(messageId, async (replyMsg) => {
            const responseText = replyMsg.message?.conversation || replyMsg.message?.extendedTextMessage?.text;
            const num = parseInt(responseText?.trim(), 10);

            if (isNaN(num) || num < 1 || num > data.styles.length) {
                await sock.sendMessage(chatId, {
                    text: `❌ Invalid number. Reply with a number between 1 and ${data.styles.length}.`
                }, { quoted: replyMsg });
                return sock.sendMessage(chatId, { react: { text: '❌', key: replyMsg.key } });
            }

            try {
                const index = num - 1;
                const styleUrl = `${BASE_API}/fancytext?q=${encodeURIComponent(query)}&style=${index}`;
                const res = await axios.get(styleUrl, { timeout: 30000 });
                const styled = res.data?.result;

                if (!styled) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Failed to generate fancy text.'
                    }, { quoted: replyMsg });
                    return sock.sendMessage(chatId, { react: { text: '❌', key: replyMsg.key } });
                }

                await sock.sendMessage(chatId, { text: styled }, { quoted: replyMsg });
                await sock.sendMessage(chatId, { react: { text: '✅', key: replyMsg.key } });
                replyHandlers.delete(messageId);

            } catch (err) {
                console.error('Fancy style error:', err);
                await sock.sendMessage(chatId, {
                    text: `❌ Error generating fancy text: ${err.message}`
                }, { quoted: replyMsg });
                await sock.sendMessage(chatId, { react: { text: '❌', key: replyMsg.key } });
            }
        });

    } catch (error) {
        console.error('Fancy command error:', error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message || 'Failed to generate fancy text'}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = { fancyCommand, replyHandlers };
