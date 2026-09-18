const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function locationCommand(sock, chatId, message) {
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '📍', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '📍 *Location Finder*\n\n❌ Please provide a location name!\n\n📌 *Usage:*\n.location Nairobi, Kenya\n.location New York\n.location Paris, France\n\nYou can also use:\n.pinlocation [name]\n.getlocation [name]'
            }, { quoted: createFakeContact(message) });
        }

        const parts = text.split(' ');
        const locationQuery = parts.slice(1).join(' ').trim();

        if (!locationQuery) {
            return await sock.sendMessage(chatId, {
                text: '📍 *Location Finder*\n\n❌ Please provide a location name!\n\n📌 *Example:*\n.location Nairobi, Kenya'
            }, { quoted: createFakeContact(message) });
        }

        if (locationQuery.length > 100) {
            return await sock.sendMessage(chatId, {
                text: '📍 *Location Finder*\n\n📝 Location name too long! Max 100 characters.'
            }, { quoted: createFakeContact(message) });
        }

        // Update presence to "recording" (searching)
        await sock.sendPresenceUpdate('recording', chatId);

        // Call API to resolve coordinates
        const apiUrl = `https://apiskeith.top/tools/location?q=${encodeURIComponent(locationQuery)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result?.results?.length) {
            throw new Error(`Could not find location for: ${locationQuery}`);
        }

        const locationData = apiData.result.results[0];
        const { lat, lng } = locationData.geometry;
        const formattedName = locationData.formatted || locationQuery;

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Send the location message
        await sock.sendMessage(chatId, {
            location: {
                degreesLatitude: lat,
                degreesLongitude: lng,
                name: formattedName,
                address: formattedName
            }
        }, { quoted: createFakeContact(message) });


        // Send final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📌', key: message.key }
        });

    } catch (error) {
        console.error("Location command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Location API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Location search timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to location service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many location requests! Please wait.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Location service is currently unavailable.';
        } else if (error.message.includes('Could not find location')) {
            errorMessage = `📍 *Location Not Found*\n\nCould not find location for: ${locationQuery}\n\n📌 *Tips:*\n• Try more specific names\n• Include city and country\n• Check spelling`;
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = locationCommand;
