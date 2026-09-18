const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { TelegraPh } = require('../lib/uploader');

// =======================
// Upload Services
// =======================

// 1. Catbox upload (permanent for any file)
const { createFakeContact } = require('../lib/fakeContact');
async function uploadToCatbox(filePath, filename) {
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", fs.createReadStream(filePath), filename);

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        return res.data.trim(); // permanent URL
    } catch (error) {
        throw new Error(`Catbox: ${error.message}`);
    }
}

// 2. Ugu.se upload
async function uploadToUgu(filePath, filename) {
    try {
        const form = new FormData();
        form.append("files[]", fs.createReadStream(filePath), filename);

        const res = await axios.post("https://uguu.se/upload.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        const data = res.data;
        if (data.success && data.files && data.files.length > 0) {
            return data.files[0].url;
        }
        throw new Error('No URL returned');
    } catch (error) {
        throw new Error(`Ugu.se: ${error.message}`);
    }
}

// 3. File.io upload (temporary but reliable)
async function uploadToFileio(filePath, filename) {
    try {
        const form = new FormData();
        form.append("file", fs.createReadStream(filePath), filename);

        const res = await axios.post("https://file.io", form, {
            headers: form.getHeaders(),
            params: { expires: '1d' },
            timeout: 30000
        });

        if (res.data.success) {
            return res.data.link;
        }
        throw new Error(res.data.message || 'Upload failed');
    } catch (error) {
        throw new Error(`File.io: ${error.message}`);
    }
}

// 4. Pomf (pomf.lain.la) upload
async function uploadToPomf(filePath, filename) {
    try {
        const form = new FormData();
        form.append("files[]", fs.createReadStream(filePath), filename);

        const res = await axios.post("https://pomf.lain.la/upload.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        const data = res.data;
        if (data.success && data.files && data.files.length > 0) {
            return `https://pomf.lain.la/${data.files[0].url}`;
        }
        throw new Error('No URL returned');
    } catch (error) {
        throw new Error(`Pomf: ${error.message}`);
    }
}

// Upload with fallback system
async function uploadWithFallback(filePath, ext) {
    const filename = `file${ext}`;
    
    // Define upload services in priority order
    const uploadServices = [
        {
            name: 'TelegraPh',
            handler: () => TelegraPh(filePath),
            supports: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        },
        {
            name: 'Catbox',
            handler: () => uploadToCatbox(filePath, filename),
            supports: '*'
        },
        {
            name: 'Ugu.se',
            handler: () => uploadToUgu(filePath, filename),
            supports: '*'
        },
        {
            name: 'Pomf',
            handler: () => uploadToPomf(filePath, filename),
            supports: '*'
        },
        {
            name: 'File.io',
            handler: () => uploadToFileio(filePath, filename),
            supports: '*'
        }
    ];

    const errors = [];
    
    for (const service of uploadServices) {
        // Skip if service doesn't support this file type (except for '*')
        if (service.supports !== '*' && !service.supports.includes(ext.toLowerCase())) {
            continue;
        }

        try {
            console.log(`[URL] Trying upload with ${service.name}...`);
            const url = await service.handler();
            
            if (url && typeof url === 'string' && url.startsWith('http')) {
                console.log(`[URL] Success with ${service.name}: ${url}`);
                return {
                    url: url,
                    service: service.name,
                    success: true
                };
            }
        } catch (error) {
            console.log(`[URL] ${service.name} failed: ${error.message}`);
            errors.push(`${service.name}: ${error.message}`);
            
            // Wait a bit before trying next service
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return {
        url: null,
        service: null,
        success: false,
        errors: errors
    };
}

// =======================
// Media Extraction
// =======================

// Extract buffer + extension from different media types
async function extractMedia(message) {
    const m = message.message || {};

    const handlers = {
        imageMessage: { type: 'image', ext: '.jpg' },
        videoMessage: { type: 'video', ext: '.mp4' },
        audioMessage: { type: 'audio', ext: '.mp3' },
        documentMessage: { type: 'document', ext: null },
        stickerMessage: { type: 'sticker', ext: '.webp' }
    };

    for (const key in handlers) {
        if (m[key]) {
            const { type, ext } = handlers[key];
            const stream = await downloadContentFromMessage(m[key], type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);

            if (key === 'documentMessage') {
                const fileName = m.documentMessage.fileName || 'file.bin';
                const fileExt = path.extname(fileName).toLowerCase();
                return { 
                    buffer: Buffer.concat(chunks), 
                    ext: fileExt || '.bin',
                    mimeType: m.documentMessage.mimetype || 'application/octet-stream'
                };
            }

            return { 
                buffer: Buffer.concat(chunks), 
                ext,
                mimeType: m[key].mimetype || null
            };
        }
    }

    return null;
}

// Extract quoted media (reply case)
async function extractQuotedMedia(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;
    return extractMedia({ message: quoted });
}

// =======================
// Main Command
// =======================
async function urlCommand(sock, chatId, message) {
    try {
        // React to message
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let media = await extractMedia(message) || await extractQuotedMedia(message);

        if (!media) {
            return sock.sendMessage(
                chatId,
                { text: 'Send or reply to a media (image, video, audio, sticker, document) to get a URL.' },
                { quoted: createFakeContact(message) }
            );
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `${Date.now()}${media.ext}`);
        fs.writeFileSync(tempPath, media.buffer);

        let result;
        try {
            // Update reaction to uploading
            await sock.sendMessage(chatId, { react: { text: '⏫', key: message.key } });
            
            // Try multiple upload services
            result = await uploadWithFallback(tempPath, media.ext);
            
            if (!result.success) {
                throw new Error('All upload services failed');
            }

        } finally {
            // Cleanup temp file
            setTimeout(() => {
                if (fs.existsSync(tempPath)) {
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (cleanupError) {
                        console.log('[URL] Cleanup error:', cleanupError.message);
                    }
                }
            }, 2000);
        }

        // Update reaction to success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // Format the response
        const responseText = `📎 *Media URL* 📎\n\n` +
                            `🔗 *Link:* ${result.url}\n` +
                            `📤 *Via:* ${result.service}`;

        // Send success response
        await sock.sendMessage(
            chatId,
            { 
                text: responseText,
                linkPreview: { 
                    showAboveText: false 
                }
            },
            { quoted: createFakeContact(message) }
        );

    } catch (error) {
        console.error('[URL] error:', error?.message || error);
        
        // Update reaction to error
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        
        let errorMessage = '❌ Failed to convert media to URL.';
        
        if (error.errors && Array.isArray(error.errors)) {
            errorMessage += '\n\n_Upload attempts:_\n';
            error.errors.forEach((err, idx) => {
                errorMessage += `${idx + 1}. ${err}\n`;
            });
        }
        
        await sock.sendMessage(
            chatId, 
            { text: errorMessage }, 
            { quoted: createFakeContact(message) }
        );
    }
}

module.exports = urlCommand;
