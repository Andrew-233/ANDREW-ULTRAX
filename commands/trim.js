const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Add this import

const { createFakeContact } = require('../lib/fakeContact');

async function trimCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "✂️", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const args = text?.split(" ").slice(1).map(t => t.trim());

        if (!args || args.length < 2) {
            return sock.sendMessage(chatId, {
                text: "❌ Reply to an audio or video file with start and end time.\n\nExample: `trim 0:10 0:30`"
            }, { quoted: createFakeContact(message) });
        }

        const [startTime, endTime] = args;
        if (!startTime || !endTime) {
            return sock.sendMessage(chatId, {
                text: "⚠️ Invalid format.\n\nExample: `trim 0:10 0:30`"
            }, { quoted: createFakeContact(message) });
        }

        // Basic time format validation (MM:SS or HH:MM:SS)
        const timeRegex = /^(\d{1,2}:)?[0-5]?\d:[0-5]?\d$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return sock.sendMessage(chatId, {
                text: "⚠️ Invalid time format. Use MM:SS or HH:MM:SS"
            }, { quoted: createFakeContact(message) });
        }

        // Check quoted media
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        if (!contextInfo?.quotedMessage) {
            return sock.sendMessage(chatId, {
                text: "❌ No quoted message found."
            }, { quoted: createFakeContact(message) });
        }

        const quotedMsg = contextInfo.quotedMessage;
        const audioMsg = quotedMsg.audioMessage;
        const videoMsg = quotedMsg.videoMessage;

        if (!audioMsg && !videoMsg) {
            return sock.sendMessage(chatId, {
                text: "❌ Unsupported media type. Quote an audio or video file."
            }, { quoted: createFakeContact(message) });
        }

        // Construct full quoted message object for download
        const fullQuotedMessage = {
            key: {
                remoteJid: contextInfo.remoteJid || chatId,
                fromMe: false,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
            },
            message: quotedMsg
        };

        // Download media as buffer
        const mediaBuffer = await downloadMediaMessage(fullQuotedMessage, 'buffer', {}, { logger: undefined });

        // Save to temp file
        const isAudio = !!audioMsg;
        const inputExt = isAudio ? '.ogg' : '.mp4'; // Guess extension from type (could be different)
        const inputPath = path.join(tempDir, `input_${Date.now()}${inputExt}`);
        fs.writeFileSync(inputPath, mediaBuffer);

        const outputExt = isAudio ? ".mp3" : ".mp4";
        const outputPath = path.join(tempDir, `trim_${Date.now()}${outputExt}`);

        // Run ffmpeg using execFile for safety
        await new Promise((resolve, reject) => {
            execFile('ffmpeg', [
                '-i', inputPath,
                '-ss', startTime,
                '-to', endTime,
                '-c', 'copy',
                outputPath
            ], (error) => {
                // Clean up input file
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                if (error) {
                    return reject(new Error(`FFmpeg error: ${error.message}`));
                }
                resolve();
            });
        });

        // Verify output exists and is not empty
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error("Trimming failed or empty file!");
        }

        // Notify user
        await sock.sendMessage(chatId, { text: `_✂️ Trimmed clip ready!_` }, { quoted: createFakeContact(message) });

        // Send trimmed media
        const trimmedBuffer = fs.readFileSync(outputPath);
        const messageContent = isAudio
            ? { audio: trimmedBuffer, mimetype: "audio/mpeg", fileName: "trimmed.mp3" }
            : { video: trimmedBuffer, mimetype: "video/mp4", fileName: "trimmed.mp4" };

        await sock.sendMessage(chatId, messageContent, { quoted: createFakeContact(message) });

        // Cleanup output
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
        console.error("Trim command error:", error);
        return sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = trimCommand;
