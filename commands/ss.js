const fetch = require('node-fetch');

const { createFakeContact } = require('../lib/fakeContact');
async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `🌐 *SCREENSHOT WEB TOOL*\n\n*.ssweb <url>*\n\nCapture a screenshot of any website\n\nExample:\n.ssweb https://example.com`,
            quoted: message
        });
        return;
    }

    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Inform user that screenshot is being captured
        await sock.sendMessage(chatId, {
            text: '🖼️ Capturing screenshot, please wait...',
            quoted: message
        });

        // Extract URL from command
        const url = match.trim();
        
        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: '🌐 Please provide a valid URL starting with http:// or https://\nExample: .ssweb https://example.com',
                quoted: message
            });
        }

        // Call the API
        const apiUrl = `https://api.zenzxz.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        // Get the image buffer
        const imageBuffer = await response.buffer();

        // Send the screenshot with caption
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: `🖥️ *Screenshot of:* ${url}`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('❌ Error in ssweb command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to capture screenshot.\nError: ${error.message}`,
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};
