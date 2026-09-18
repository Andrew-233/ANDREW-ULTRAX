const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');

const { createFakeContact } = require('../lib/fakeContact');
async function smemeCommand(sock, chatId, message) {
    const messageToQuote = message;
    let text = '';

    if (message.message?.conversation) {
        text = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
    }

    text = text.replace(/^\.smeme\s*/i, '').trim();

    let targetMessage = message;
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedInfo = message.message.extendedTextMessage.contextInfo;
        targetMessage = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }

    const mediaMessage = targetMessage.message?.imageMessage || targetMessage.message?.videoMessage || targetMessage.message?.documentMessage || targetMessage.message?.stickerMessage;

    if (!mediaMessage) {
        await sock.sendMessage(chatId, { 
            text: 'Please reply to an image/video/sticker with .smeme <text>, or send an image/video/sticker with .smeme <text> as the caption.\n\nExample: .smeme YOUR MEME TEXT'
        },{ quoted: messageToQuote });
        return;
    }

    if (!text || text.trim() === '') {
        await sock.sendMessage(chatId, { 
            text: 'Please provide meme text!\n\nExample: .smeme YOUR MEME TEXT'
        },{ quoted: messageToQuote });
        return;
    }

    try {
        const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
            logger: undefined, 
            reuploadRequest: sock.updateMediaMessage 
        });

        if (!mediaBuffer) {
            await sock.sendMessage(chatId, { text: 'Failed to download media. Please try again.' }, { quoted: createFakeContact(message) });
            return;
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const randomId = Date.now();
        const tempInput = path.join(tmpDir, `temp_${randomId}`);
        const tempOutput = path.join(tmpDir, `meme_${randomId}.webp`);

        fs.writeFileSync(tempInput, mediaBuffer);

        const isAnimated = mediaMessage.mimetype?.includes('gif') || 
                          mediaMessage.mimetype?.includes('video') || 
                          mediaMessage.seconds > 0 ||
                          (mediaMessage.isAnimated === true);

        const escapeText = (text) => {
            return text.replace(/\\/g, '\\\\')
                .replace(/'/g, "'\\''")
                .replace(/:/g, '\\:')
                .replace(/\[/g, '\\[')
                .replace(/\]/g, '\\]')
                .replace(/,/g, '\\,')
                .replace(/;/g, '\\;')
                .replace(/\n/g, '\\n');
        };

        const escapedText = escapeText(text);
        const fontSize = 40;
        const lineSpacing = 10;
        const lines = text.split('\n');
        const totalTextHeight = (fontSize + lineSpacing) * lines.length;
        let textFilter = `drawtext=text='${escapedText}':fontcolor=white:fontsize=${fontSize}:x=(w-tw)/2:y=h-th-${totalTextHeight + 10}:borderw=3:bordercolor=black:fontfile='C\\\\:/Windows/Fonts/impact.ttf':line_spacing=${lineSpacing}`;

        let ffmpegCommand;
        if (isAnimated) {
            const isVideo = mediaMessage.mimetype?.includes('video') || 
                           mediaMessage.seconds > 5 ||
                           (mediaMessage.fileLength && mediaMessage.fileLength > 1000000);
            if (isVideo) {
                const duration = mediaMessage.seconds || 10;
                const maxDuration = Math.min(duration, 15);
                ffmpegCommand = `ffmpeg -i "${tempInput}" -t ${maxDuration} -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,${textFilter},fps=20,setpts=0.5*PTS" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            } else {
                ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,${textFilter},fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            }
        } else {
            ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,${textFilter},format=rgba" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
        }

        const fontPaths = [
            'C\\\\:/Windows/Fonts/impact.ttf',
            '/usr/share/fonts/truetype/msttcorefonts/impact.ttf',
            '/usr/share/fonts/TTF/impact.ttf',
            '/Library/Fonts/impact.ttf'
        ];

        let ffmpegSuccess = false;
        let lastError = null;

        for (const fontPath of fontPaths) {
            try {
                const altFfmpegCommand = ffmpegCommand.replace(/fontfile='[^']*'/g, `fontfile='${fontPath}'`);
                await new Promise((resolve, reject) => {
                    exec(altFfmpegCommand, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                ffmpegSuccess = true;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!ffmpegSuccess && textFilter) {
            try {
                const noFontCommand = ffmpegCommand.replace(/fontfile='[^']*'/g, '');
                await new Promise((resolve, reject) => {
                    exec(noFontCommand, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                ffmpegSuccess = true;
            } catch (error) {
                lastError = error;
            }
        }

        if (!ffmpegSuccess) throw lastError || new Error('FFmpeg processing failed');
        if (!fs.existsSync(tempOutput)) throw new Error('FFmpeg did not create output file');

        const webpBuffer = fs.readFileSync(tempOutput);
        if (webpBuffer.length === 0) throw new Error('Generated WebP file is empty');

        const img = new webp.Image();
        await img.load(webpBuffer);

        const json = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': settings.packname || 'June-x Meme',
            'emojis': ['😂']
        };

        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        img.exif = exif;
        const finalBuffer = await img.save(null);

        await sock.sendMessage(chatId, { sticker: finalBuffer },{ quoted: messageToQuote });

        try {
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
        } catch {}
    } catch (error) {
        let errorMessage = 'Failed to create meme sticker! ';
        if (error.message.includes('ffmpeg')) errorMessage += 'Make sure ffmpeg is installed. ';
        errorMessage += '\n\nError: ' + error.message;
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: createFakeContact(message) });
    }
}

module.exports = smemeCommand;
