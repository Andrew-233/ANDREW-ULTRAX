const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function fetchCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a valid URL to fetch." 
            }, { quoted: createFakeContact(message) });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Invalid URL format. Please provide a valid URL." 
            }, { quoted: createFakeContact(message) });
        }

        // Fetch content from URL
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 70000, // Increased timeout for larger files
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const contentType = response.headers['content-type'];
        const contentLength = response.headers['content-length'];
        
        if (!contentType) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Server did not return a content-type." 
            }, { quoted: createFakeContact(message) });
        }

        const buffer = Buffer.from(response.data);
        const filename = url.split('/').pop() || "file";
        
        // Check file size limit (WhatsApp has limits, adjust as needed)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for large files
        if (buffer.length > MAX_FILE_SIZE) {
            return await sock.sendMessage(chatId, { 
                text: `❌ File is too large (${(buffer.length / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` 
            }, { quoted: createFakeContact(message) });
        }

        // Handle different content types
        if (contentType.includes('application/json')) {
            try {
                const json = JSON.parse(buffer.toString());
                const jsonString = JSON.stringify(json, null, 2);
                return await sock.sendMessage(chatId, { 
                    text: "```json\n" + jsonString + "\n```" 
                }, { quoted: createFakeContact(message) });
            } catch (parseError) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ Failed to parse JSON. Sending as text.\n" + buffer.toString() 
                }, { quoted: createFakeContact(message) });
            }
        }

        if (contentType.includes('text/html')) {
            const html = buffer.toString();
            return await sock.sendMessage(chatId, { 
                text: html 
            }, { quoted: createFakeContact(message) });
        }

        if (contentType.includes('text/')) {
            return await sock.sendMessage(chatId, { 
                text: buffer.toString() 
            }, { quoted: createFakeContact(message) });
        }

        if (contentType.includes('image')) {
            // Check image size for WhatsApp limits
            if (buffer.length > 16 * 1024 * 1024) { // 16MB limit for images
                return await sock.sendMessage(chatId, {
                    document: buffer,
                    fileName: filename,
                    mimetype: contentType
                }, { quoted: createFakeContact(message) });
            }
            return await sock.sendMessage(chatId, { 
                image: buffer,
                caption: `📷 ${url}` 
            }, { quoted: createFakeContact(message) });
        }

        if (contentType.includes('video')) {
            // Check video size for WhatsApp limits
            if (buffer.length > 16 * 1024 * 1024) { // 16MB limit for videos
                return await sock.sendMessage(chatId, {
                    document: buffer,
                    fileName: filename,
                    mimetype: contentType,
                    caption: `📹 Video too large for inline display. Sent as document.`
                }, { quoted: createFakeContact(message) });
            }
            return await sock.sendMessage(chatId, { 
                video: buffer,
                caption: `📹 ${url}` 
            }, { quoted: createFakeContact(message) });
        }

        if (contentType.includes('audio')) {
            return await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: contentType,
                fileName: filename
            }, { quoted: createFakeContact(message) });
        }

        if (contentType.includes('application/pdf')) {
            return await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: "application/pdf",
                fileName: filename.endsWith('.pdf') ? filename : `${filename}.pdf`
            }, { quoted: createFakeContact(message) });
        }

        // Handle other document types
        if (contentType.includes('application')) {
            return await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: contentType,
                fileName: filename
            }, { quoted: createFakeContact(message) });
        }

        // Default fallback - send as document if content type is unknown
        return await sock.sendMessage(chatId, {
            document: buffer,
            fileName: filename,
            mimetype: contentType || 'application/octet-stream'
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error('Error in fetchCommand:', error);
        
        let errorMessage = "❌ Failed to fetch the URL. ";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "Request timeout. The server took too long to respond.";
        } else if (error.response) {
            errorMessage += `Server responded with status: ${error.response.status}`;
        } else if (error.request) {
            errorMessage += "No response received from server.";
        } else {
            errorMessage += "Please check the URL and try again.";
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: createFakeContact(message) });
        
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = fetchCommand;
