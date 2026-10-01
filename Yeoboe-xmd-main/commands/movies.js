const fs = require("fs");
const axios = require("axios");
const path = require("path");
const fetch = require("node-fetch");

const { createFakeContact } = require('../lib/fakeContact');
async function moviesCommand(sock, chatId, message) {
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                      "AppleWebKit/537.36 (KHTML, like Gecko) " +
                      "Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://movieapi.xcasper.space/"
    };

    try {
        await sock.sendMessage(chatId, { react: { text: "🎬", key: message.key } });

        // Resolve query from direct text or quoted message
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = text ? text.split(" ").slice(1).join(" ").trim() : null;

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            query = quoted.conversation?.trim() || quoted.extendedTextMessage?.text?.trim() || null;
        }

        if (!query) {
            return sock.sendMessage(chatId, {
                text: "🎬 Provide a movie name to search\nExample: .movies Avatar"
            }, { quoted: createFakeContact(message) });
        }

        if (query.length > 100) {
            return sock.sendMessage(chatId, {
                text: "📝 Movie name too long! Max 100 chars."
            }, { quoted: createFakeContact(message) });
        }

        // Search movie
        const searchResponse = await fetch(
            `https://movieapi.xcasper.space/api/showbox/search?keyword=${encodeURIComponent(query)}&type=movie`,
            { headers }
        );
        const searchResult = await searchResponse.json();

        if (!searchResult.data?.length) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that movie. Try another one!"
            }, { quoted: createFakeContact(message) });
        }

        const movie = searchResult.data[0];

        // Get stream links
        const streamResponse = await fetch(
            `https://movieapi.xcasper.space/api/stream?id=${movie.id}&type=movie`,
            { headers }
        );
        const streamResult = await streamResponse.json();

        if (!streamResult.data?.links?.length) {
            return sock.sendMessage(chatId, {
                text: "🚫 No streaming links available for this movie!"
            }, { quoted: createFakeContact(message) });
        }

        // Build result text
        let resultText = `🎬 *${movie.title}* ${movie.releaseDate ? `(${movie.releaseDate})` : ''}\n\n` +
                         `⭐ *Rating:* ${movie.rating || 'N/A'}\n` +
                         `🎭 *Genres:* ${movie.genres?.join(', ') || 'N/A'}\n` +
                         `⏱️ *Duration:* ${movie.duration || 'N/A'}\n` +
                         `📝 *Description:* ${movie.description || 'No description available'}\n\n` +
                         `🔗 *Streaming Links:*\n`;

        for (const link of streamResult.data.links) {
            resultText += `\n🎥 *${link.provider}*\n📺 ${link.quality || 'Auto'}\n🔗 ${link.url}\n`;
        }

        // Send poster if available
        if (movie.poster) {
            try {
                const posterResponse = await axios.get(movie.poster, {
                    responseType: "stream",
                    timeout: 30000,
                    headers
                });

                const posterPath = path.join(tempDir, `poster_${Date.now()}.jpg`);
                const writer = fs.createWriteStream(posterPath);
                posterResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });

                await sock.sendMessage(chatId, {
                    image: { url: posterPath },
                    caption: resultText
                }, { quoted: createFakeContact(message) });

                fs.unlinkSync(posterPath);
            } catch (err) {
                console.error("\x1b[35mPoster download error:\x1b[0m", err);
                await sock.sendMessage(chatId, { text: resultText }, { quoted: createFakeContact(message) });
            }
        } else {
            await sock.sendMessage(chatId, { text: resultText }, { quoted: createFakeContact(message) });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error("\x1b[35mMovies command error:\x1b[0m", error);
        await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = moviesCommand;
