const { createFakeContact } = require('../lib/fakeContact');
async function lastseenCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '⏱️', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text?.split(' ').slice(1).join(' ').trim().toLowerCase();

        // Show usage if no argument provided
        if (!query) {
            return sock.sendMessage(chatId, { 
                text: '🔧 *Last Seen Privacy Settings*\n\n' +
                      'Usage: .lastseen <option>\n\n' +
                      'Options:\n' +
                      '• all - Everyone can see your last seen\n' +
                      '• contacts - Only your contacts can see your last seen\n' +
                      '• none - No one can see your last seen\n\n' +
                      'Example: .lastseen contacts'
            }, { quoted: createFakeContact(message) });
        }

        // Validate option
        const validOptions = {
            all: 'Everyone can see your last seen',
            contacts: 'Only your contacts can see your last seen',
            none: 'No one can see your last seen'
        };

        if (!validOptions[query]) {
            return sock.sendMessage(chatId, { 
                text: '❌ Invalid option!\n\n' +
                      'Valid options: all, contacts, none\n' +
                      'Example: .lastseen contacts'
            }, { quoted: createFakeContact(message) });
        }

        // Update last seen privacy
        await sock.updateLastSeenPrivacy(query);

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Success message
        return sock.sendMessage(chatId, {
            text: `✅ *Last Seen Privacy Updated*\n\n` +
                  `Your last seen privacy has been set to: *${query}*\n` +
                  `📝 ${validOptions[query]}\n\n` +
                  `⚡ Changes may take a few moments to apply.`
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("Lastseen command error:", error);

        let errorMessage = 'Error: ' + error.message;
        if (error.message.includes('privacy')) errorMessage = 'Failed to update privacy settings. Please try again.';
        else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') errorMessage = 'Request timed out! Try again.';
        else if (error.code === 'ENOTFOUND') errorMessage = 'Cannot connect to WhatsApp service!';

        return sock.sendMessage(chatId, { text: `🚫 ${errorMessage}` }, { quoted: createFakeContact(message) });
    }
}

module.exports = lastseenCommand;
