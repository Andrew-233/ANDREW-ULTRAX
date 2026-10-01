const fs = require("fs");
const path = require("path");
const os = require("os");
const JsConfuser = require('js-confuser');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const { createFakeContact } = require('../lib/fakeContact');
async function encryptCommand(sock, chatId, message, isOwner) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🔐", key: message.key }
        });

        // Derive sender from message
        const sender = message.key.participant || message.key.remoteJid;

        // Use system temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Ensure we have a quoted message
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            return await sock.sendMessage(chatId, {
                text: "🔐 *Encrypt Command Usage*\n\n" +
                      "Reply to a JavaScript (.js) file with ```.enc``` or ```.encrypt```\n\n" +
                      "📌 *Example:*\n" +
                      "1. Send a .js file\n" +
                      "2. Reply to it with ```.enc```\n\n" +
                      "✨ *Features:*\n" +
                      "• Hard code obfuscation\n" +
                      "• Variable renaming\n" +
                      "• String encoding\n" +
                      "• Control flow flattening"
            }, { quoted: createFakeContact(message) });
        }

        const doc = quotedMsg.documentMessage;
        if (!doc || !doc.fileName || !doc.fileName.endsWith('.js')) {
            return await sock.sendMessage(chatId, {
                text: "❌ *Invalid File*\nPlease reply to a JavaScript (.js) file to encrypt."
            }, { quoted: createFakeContact(message) });
        }

        // Send processing status
        await sock.sendMessage(chatId, {
            text: `🔄 *Processing Encryption*\n📄 File: ${doc.fileName}\n⏱️ This may take a few moments...`
        }, { quoted: createFakeContact(message) });

        // Download the file (stream -> buffer)
        const stream = await downloadContentFromMessage(doc, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (!buffer || buffer.length === 0) {
            throw new Error("Failed to download the file or file is empty!");
        }

        const fileSize = buffer.length;
        const fileSizeKB = (fileSize / 1024).toFixed(2);
        
        // Check file size (max 5MB to prevent abuse)
        if (fileSize > 5 * 1024 * 1024) {
            return await sock.sendMessage(chatId, {
                text: "❌ *File Too Large*\nMaximum file size is 5MB for encryption."
            }, { quoted: createFakeContact(message) });
        }

        const fileName = doc.fileName;
        const originalCode = buffer.toString('utf8');

        // Obfuscate with progress reaction
        await sock.sendMessage(chatId, {
            react: { text: "⚙️", key: message.key }
        });

        const obfuscatedCode = await JsConfuser.obfuscate(originalCode, {
            target: "node",
            preset: "high",
            compact: true,
            minify: true,
            flatten: true,
            identifierGenerator: function() {
                const originalString = "素GIDDY晴TENNOR晴" + "素GIDDY晴TENNOR晴";
                const removeUnwantedChars = (input) => input.replace(/[^a-zA-Z素GIDDY晴TENNOR晴]/g, "");
                const randomString = (length) => {
                    let result = "";
                    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
                    for (let i = 0; i < length; i++) {
                        result += characters.charAt(Math.floor(Math.random() * characters.length));
                    }
                    return result;
                };
                return removeUnwantedChars(originalString) + randomString(2);
            },
            renameVariables: true,
            renameGlobals: true,
            stringEncoding: true,
            stringSplitting: 0.0,
            stringConcealing: true,
            stringCompression: true,
            duplicateLiteralsRemoval: 1.0,
            shuffle: { hash: 0.0, true: 0.0 },
            stack: true,
            controlFlowFlattening: 1.0,
            opaquePredicates: 0.9,
            deadCode: 0.0,
            dispatcher: true,
            rgf: false,
            calculator: true,
            hexadecimalNumbers: true,
            movedDeclarations: true,
            objectExtraction: true,
            globalConcealing: true,
        });

        const obfuscatedSize = Buffer.byteLength(obfuscatedCode, 'utf8');
        const obfuscatedSizeKB = (obfuscatedSize / 1024).toFixed(2);
        const sizeIncrease = ((obfuscatedSize - fileSize) / fileSize * 100).toFixed(2);

        // Create temp file for backup (optional)
        const timestamp = Date.now();
        const tempFilePath = path.join(tempDir, `encrypted_${timestamp}.js`);
        fs.writeFileSync(tempFilePath, obfuscatedCode);

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

        // Send obfuscated file back
        await sock.sendMessage(chatId, {
            document: Buffer.from(obfuscatedCode, 'utf8'),
            mimetype: 'application/javascript',
            fileName: `${fileName}`,
            caption: `🔐 *Encryption Successful*\n\n` +
                    `📄 *File:* ${fileName}\n` +
                    `📦 *Original Size:* ${fileSizeKB} KB\n` +
                    `📦 *Encrypted Size:* ${obfuscatedSizeKB} KB\n` +
                    `📈 *Increase:* ${sizeIncrease}%\n` +
                    `🔧 *Type:* Hard Code Obfuscation\n` +
                    `✨ *Features:* Variable Renaming, String Encoding, Control Flow Flattening\n` +
                    `👑 *@Tennor-modz*`
        }, { quoted: createFakeContact(message) });

        // Optional log – only for owners (sender is now defined)
        if (isOwner && sender) {
            console.log(`🔐 File encrypted: ${fileName} (${fileSizeKB}KB -> ${obfuscatedSizeKB}KB) by ${sender}`);
        }

        // Cleanup temp file
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    } catch (error) {
        console.error("Encrypt command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
        
        let errorMessage = `🚫 *Encryption Error:* ${error.message}`;
        
        if (error.message.includes('syntax')) {
            errorMessage = "❌ *Syntax Error!*\nThe JavaScript file contains syntax errors that prevent encryption.";
        } else if (error.message.includes('download')) {
            errorMessage = "❌ *Download Failed!*\nCould not download the file. Please try again.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "⏱️ *Encryption Timeout!*\nThe file might be too complex. Try with a simpler script.";
        }
        
        return await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = encryptCommand;
