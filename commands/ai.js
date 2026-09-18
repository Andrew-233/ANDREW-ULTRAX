const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
/**
 * AI Command Handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Message object
 */
async function aiCommand(sock, chatId, message) {
    try {
        const text = extractMessageText(message);

        if (!text) {
            return sendPromptMessage(sock, chatId, message);
        }

        const { command, query } = parseCommand(text);

        if (!query) {
            return sendEmptyQueryMessage(sock, chatId, message);
        }

        await processAIRequest(sock, chatId, message, query);
    } catch (error) {
        logError('AI Command Error', error);
        return sendErrorMessage(sock, chatId, message);
    }
}

/**
 * Extract text from message object
 */
function extractMessageText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.text ||
        null
    );
}

/**
 * Parse command and query from text
 */
function parseCommand(text) {
    const [command, ...rest] = text.trim().split(/\s+/);
    return {
        command: command?.toLowerCase() || '',
        query: rest.join(' ').trim(),
    };
}

/**
 * Send initial prompt message
 */
async function sendPromptMessage(sock, chatId, message) {
    const promptText =
        "⚠️ Please provide a question after !gpt\n\n" +
        "Example: !gpt What is quantum computing?";
    return sock.sendMessage(chatId, { text: promptText }, { quoted: createFakeContact(message) });
}

/**
 * Send empty query message
 */
async function sendEmptyQueryMessage(sock, chatId, message) {
    const text =
        "❌ No query detected.\nExample: !gpt What is quantum computing?";
    return sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
}

/**
 * Send generic error message
 */
async function sendErrorMessage(sock, chatId, message) {
    return sock.sendMessage(
        chatId,
        {
            text: "❌ An error occurred. Please try again later.",
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid],
                quotedMessage: message.message,
            },
        },
        { quoted: createFakeContact(message) }
    );
}

/**
 * Process AI request
 */
async function processAIRequest(sock, chatId, message, query) {
    // Show processing indicator
    await sock.sendMessage(chatId, {
        react: { text: '🤖', key: message.key },
    });

    try {
        await handleAIAPIRequest(sock, chatId, message, query);
    } catch (error) {
        logError('API Processing Error', error);
        await sendAPIErrorMessage(sock, chatId, message, error);
    }
}

/**
 * Handle AI API request
 */
async function handleAIAPIRequest(sock, chatId, message, query) {
    const apiUrl = `https://iamtkm.vercel.app/ai/gpt5?apikey=tkm&text=${encodeURIComponent(
        query
    )}`;

    const { data } = await axios.get(apiUrl).catch((err) => {
        throw err;
    });

    const replyText = data?.result || null;

    if (replyText) {
        return sock.sendMessage(chatId, { text: replyText }, { quoted: createFakeContact(message) });
    }

    throw new Error('No valid response from AI API');
}

/**
 * Send API error message
 */
async function sendAPIErrorMessage(sock, chatId, message, error) {
    const errorMessage =
        error.response?.status === 429
            ? "❌ Rate limit exceeded. Please try again later."
            : "❌ Failed to reach AI API.";

    return sock.sendMessage(
        chatId,
        {
            text: errorMessage,
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid],
                quotedMessage: message.message,
            },
        },
        { quoted: createFakeContact(message) }
    );
}

/**
 * Log error with context
 */
function logError(context, error) {
    console.error(`[${context}]`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data || null,
    });
}

module.exports = aiCommand;
