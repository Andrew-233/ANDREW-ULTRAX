const fetch = require('node-fetch');

async function obfuscateCommand(sock, chatId, message, userMessage) {
    try {
        // Check if user is owner/sudo
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSudo } = require('../lib/index');
        const senderIsSudo = await isSudo(senderId);
        
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only owner/sudo can use this command!' 
            }, { quoted: message });
            return;
        }

        // Extract code from message
        const code = userMessage.replace(/^\.obfuscate\s+|^\.obfs\s+/i, '').trim();
        
        if (!code) {
            await sock.sendMessage(chatId, { 
                text: `❌ Please provide JavaScript code to obfuscate!\n\nUsage: .obfs <javascript code>\nExample: .obfs console.log("Hello World");` 
            }, { quoted: message });
            return;
        }

        // Show processing message
        await sock.sendMessage(chatId, { 
            text: '🔏 Obfuscating JavaScript code...' 
        }, { quoted: message });

        // Call obfuscation API
        const apiUrl = `https://apiskeith.top/tools/encrypt2?q=${encodeURIComponent(code)}`;
        const response = await fetch(apiUrl);
        const json = await response.json();

        if (!json || json.status !== 'success' || !json.obfuscated) {
            console.error('Obfuscation API error:', json);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to obfuscate the code. Please try again with valid JavaScript.' 
            }, { quoted: message });
            return;
        }

        const obfuscatedCode = json.obfuscated;
        
        // Create info message
        const info = `
╭━━[ 𝐉𝐀𝐕𝐀𝐒𝐂𝐑𝐈𝐏𝐓 𝐎𝐁𝐅𝐔𝐒𝐂𝐀𝐓𝐎𝐑 ]━━╮
│
│ 🔐 *Service:* TRUTH Tech API
│ 📏 *Original Size:* ${code.length} chars
│ 🛡️ *Obfuscated Size:* ${obfuscatedCode.length} chars
│ 📁 *File:* hans-obfuscated.js
│
│ 💡 *Note:* Obfuscated code is in attached file
│
╰━━━━━━━━━━━━━━━━━━━━━━━╯
        `.trim();

        // Send as text file
        await sock.sendMessage(chatId, {
            document: Buffer.from(obfuscatedCode, 'utf8'),
            fileName: 'hans-obfuscated.js',
            mimetype: 'application/javascript',
            caption: info
        }, { quoted: message });

        // Send success reaction
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in obfuscate command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}` 
        }, { quoted: message });
    }
}

// Alternative version with multiple obfuscation methods
async function obfuscateAdvancedCommand(sock, chatId, message, userMessage) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSudo } = require('../lib/index');
        const senderIsSudo = await isSudo(senderId);
        
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only owner/sudo can use this command!' 
            }, { quoted: message });
            return;
        }

        // Extract code and options
        const parts = userMessage.split(' ');
        const command = parts[0];
        let code, level = 'medium';
        
        if (parts.length < 2) {
            await sock.sendMessage(chatId, { 
                text: `❌ Please provide JavaScript code!\n\nUsage: ${command} <code>\nExample: ${command} function test(){console.log("hi")};\n\nLevels: low, medium, high, extreme` 
            }, { quoted: message });
            return;
        }
        
        // Check if last part is a level
        const lastPart = parts[parts.length - 1].toLowerCase();
        const levels = ['low', 'medium', 'high', 'extreme'];
        
        if (levels.includes(lastPart)) {
            level = lastPart;
            code = parts.slice(1, -1).join(' ');
        } else {
            code = parts.slice(1).join(' ');
        }
        
        if (!code || code.length < 3) {
            await sock.sendMessage(chatId, { 
                text: '❌ Code too short or empty!' 
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `🔄 Obfuscating JavaScript with ${level} protection...` 
        }, { quoted: message });

        // Choose API based on level
        let apiUrl;
        switch(level) {
            case 'low':
                apiUrl = `https://hanstech-api.zone.id/api/js-obfuscate-light?code=${encodeURIComponent(code)}`;
                break;
            case 'high':
                apiUrl = `https://hanstech-api.zone.id/api/js-obfuscate-hard?code=${encodeURIComponent(code)}`;
                break;
            case 'extreme':
                apiUrl = `https://hanstech-api.zone.id/api/js-obfuscate-extreme?code=${encodeURIComponent(code)}`;
                break;
            default: // medium
                apiUrl = `https://hanstech-api.zone.id/api/js-obfuscate?code=${encodeURIComponent(code)}&key=hans%7EUfvyXEb`;
        }

        const response = await fetch(apiUrl);
        const json = await response.json();

        if (!json || !json.obfuscated) {
            // Try fallback API
            const fallbackUrl = `https://obfuscator.io/api/obfuscate`;
            const fallbackResponse = await fetch(fallbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    options: {
                        compact: true,
                        controlFlowFlattening: level === 'extreme' || level === 'high',
                        deadCodeInjection: level === 'extreme',
                        debugProtection: level === 'extreme',
                        identifierNamesGenerator: 'hexadecimal',
                        renameGlobals: false,
                        selfDefending: true,
                        stringArray: true,
                        stringArrayEncoding: ['base64'],
                        stringArrayThreshold: 0.75,
                        transformObjectKeys: true,
                        unicodeEscapeSequence: false
                    }
                })
            });
            
            const fallbackJson = await fallbackResponse.json();
            
            if (!fallbackJson.obfuscated) {
                throw new Error('All obfuscation APIs failed');
            }
            
            await sendObfuscatedResult(sock, chatId, message, code, fallbackJson.obfuscated, level);
            return;
        }

        await sendObfuscatedResult(sock, chatId, message, code, json.obfuscated, level);

    } catch (error) {
        console.error('Error in advanced obfuscate:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Obfuscation failed: ${error.message}` 
        }, { quoted: message });
    }
}

async function sendObfuscatedResult(sock, chatId, message, originalCode, obfuscatedCode, level) {
    // Create stats
    const originalSize = originalCode.length;
    const obfuscatedSize = obfuscatedCode.length;
    const compressionRatio = ((obfuscatedSize / originalSize) * 100).toFixed(1);
    
    const stats = `
╭━━[ 𝐉𝐒 𝐎𝐁𝐅𝐔𝐒𝐂𝐀𝐓𝐈𝐎𝐍 𝐑𝐄𝐒𝐔𝐋𝐓 ]━━╮
│
│ 🔒 *Protection Level:* ${level.toUpperCase()}
│ 📊 *Original Size:* ${originalSize} characters
│ 🛡️ *Obfuscated Size:* ${obfuscatedSize} characters
│ 📈 *Size Ratio:* ${compressionRatio}%
│ 📁 *Filename:* obfuscated-${Date.now()}.js
│
│ ⚠️ *Warning:* Obfuscation makes code harder to reverse engineer
│    but doesn't provide complete security.
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
    `.trim();
    
    // Send as file
    await sock.sendMessage(chatId, {
        document: Buffer.from(obfuscatedCode, 'utf8'),
        fileName: `obfuscated-${Date.now()}.js`,
        mimetype: 'application/javascript',
        caption: stats
    }, { quoted: message });
    
    // Also send a preview (first 200 chars)
    if (obfuscatedCode.length > 200) {
        const preview = obfuscatedCode.substring(0, 200) + '...';
        await sock.sendMessage(chatId, {
            text: `📋 *Preview (first 200 chars):*\n\`\`\`javascript\n${preview}\n\`\`\``
        }, { quoted: message });
    }
    
    await sock.sendMessage(chatId, { 
        react: { text: '✅', key: message.key } 
    });
}

// Simple version for quick obfuscation
async function quickObfuscateCommand(sock, chatId, message, userMessage) {
    try {
        // Extract code (remove command)
        const code = userMessage.replace(/^\.[a-z]+\s+/i, '').trim();
        
        if (!code) {
            await sock.sendMessage(chatId, { 
                text: '❌ Need JavaScript code to obfuscate!' 
            });
            return;
        }
        
        // Simple obfuscation (base64 encode)
        const obfuscated = `eval(atob('${Buffer.from(code).toString('base64')}'))`;
        
        await sock.sendMessage(chatId, {
            text: `🔐 *Quick Obfuscation*\n\n*Original:* ${code.length} chars\n*Obfuscated:* ${obfuscated.length} chars\n\n\`\`\`javascript\n${obfuscated}\n\`\`\``
        }, { quoted: message });
        
    } catch (error) {
        console.error('Quick obfuscate error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Quick obfuscation failed' 
        });
    }
}

module.exports = {
    obfuscateCommand,
    obfuscateAdvancedCommand,
    quickObfuscateCommand
};
