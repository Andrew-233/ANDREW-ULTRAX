const TicTacToe = require('../lib/tictactoe');

// Store games globally
const games = {};

const { createFakeContact } = require('../lib/fakeContact');
async function tictactoeCommand(sock, chatId, senderId, text) {
    try {
        // Check if player is already in a game
        const existingGame = Object.values(games).find(room => 
            room.id.startsWith('tictactoe') && 
            [room.game.playerX, room.game.playerO].includes(senderId)
        );
        
        if (existingGame) {
            await sock.sendMessage(chatId, { 
                text: '❌ You are still in a game. Type *surrender* to quit.' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        // Clean up any stale waiting games (older than 5 minutes)
        const now = Date.now();
        Object.keys(games).forEach(roomId => {
            if (games[roomId].id.startsWith('tictactoe') && 
                games[roomId].state === 'WAITING' && 
                (now - parseInt(roomId.split('-')[1])) > 300000) { // 5 minutes
                delete games[roomId];
            }
        });

        // Look for existing waiting room
        let room = Object.values(games).find(room => 
            room.id.startsWith('tictactoe') && 
            room.state === 'WAITING' &&
            room.x !== chatId && // Prevent same group from joining its own waiting room
            (text ? room.name === text : true)
        );

        if (room) {
            // Join existing room
            room.o = chatId;
            room.game.playerO = senderId;
            room.game.currentTurn = room.game.playerX; // X starts first
            room.state = 'PLAYING';

            const arr = room.game.render().map(v => ({
                'X': '❎',
                'O': '⭕',
                '1': '1️⃣',
                '2': '2️⃣',
                '3': '3️⃣',
                '4': '4️⃣',
                '5': '5️⃣',
                '6': '6️⃣',
                '7': '7️⃣',
                '8': '8️⃣',
                '9': '9️⃣',
            }[v]));

            const str = `
🎮 *TicTacToe Game Started!*

Player ❎: @${room.game.playerX.split('@')[0]}
Player ⭕: @${room.game.playerO.split('@')[0]}

@${room.game.currentTurn.split('@')[0]}'s turn (❎)...

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ *Room ID:* ${room.id}
▢ *Rules:*
• Make 3 rows of symbols vertically, horizontally or diagonally to win
• Type a number (1-9) to place your symbol
• Type *surrender* to give up
`;

            // Send game start message to both chats
            await sock.sendMessage(room.x, { 
                text: str,
                mentions: [room.game.playerX, room.game.playerO]
            }, { quoted: createFakeContact(message) });

            if (room.x !== room.o) {
                await sock.sendMessage(room.o, { 
                    text: str,
                    mentions: [room.game.playerX, room.game.playerO]
                }, { quoted: createFakeContact(message) });
            }

        } else {
            // Create new room
            const gameId = 'tictactoe-' + Date.now();
            
            // Initialize the game with sender as player X
            const game = new TicTacToe(senderId, 'o');
            
            room = {
                id: gameId,
                x: chatId,
                o: null, // Will be set when opponent joins
                game: game,
                state: 'WAITING',
                created: Date.now()
            };

            if (text) room.name = text;

            games[room.id] = room;

            await sock.sendMessage(chatId, { 
                text: `⏳ *Waiting for opponent...*\n\nType *.ttt ${text || ''}* to join!` +
                      `\n\n▢ *Room ID:* ${room.id}` +
                      `\n▢ *Timeout:* 5 minutes`
            });
        }

    } catch (error) {
        console.error('Error in tictactoe command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error starting game. Please try again.' 
        }, { quoted: createFakeContact(message) });
    }
}

async function handleTicTacToeMove(sock, chatId, senderId, text) {
    try {
        // Find player's game
        const room = Object.values(games).find(room => 
            room.id.startsWith('tictactoe') && 
            [room.game.playerX, room.game.playerO].includes(senderId) && 
            room.state === 'PLAYING'
        );

        if (!room) return;

        const isSurrender = /^(surrender|give up|surrender|ff|resign)$/i.test(text);
        
        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Allow surrender at any time, not just during player's turn
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, { 
                text: '❌ Not your turn!' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        let ok;
        if (isSurrender) {
            ok = true;
        } else {
            ok = room.game.turn(
                senderId === room.game.playerO,
                parseInt(text) - 1
            );
        }

        if (!ok && !isSurrender) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid move! That position is already taken.' 
            }, { quoted: createFakeContact(message) });
            return;
        }

        let winner = room.game.winner;
        let isTie = room.game.turns === 9;

        const arr = room.game.render().map(v => ({
            'X': '❎',
            'O': '⭕',
            '1': '1️⃣',
            '2': '2️⃣',
            '3': '3️⃣',
            '4': '4️⃣',
            '5': '5️⃣',
            '6': '6️⃣',
            '7': '7️⃣',
            '8': '8️⃣',
            '9': '9️⃣',
        }[v]));

        if (isSurrender) {
            // Set the winner to the opponent of the surrendering player
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            
            // Send surrender message
            const surrenderMsg = `🏳️ @${senderId.split('@')[0]} has surrendered!\n@${winner.split('@')[0]} wins the game!`;
            
            await sock.sendMessage(room.x, { 
                text: surrenderMsg,
                mentions: [senderId, winner]
            }, { quoted: createFakeContact(message) });
            
            if (room.x !== room.o) {
                await sock.sendMessage(room.o, { 
                    text: surrenderMsg,
                    mentions: [senderId, winner]
                }, { quoted: createFakeContact(message) });
            }
            
            // Delete the game
            delete games[room.id];
            return;
        }

        let gameStatus;
        let mentions = [room.game.playerX, room.game.playerO];
        
        if (winner) {
            gameStatus = `🎉 @${winner.split('@')[0]} wins the game!`;
            mentions.push(winner);
        } else if (isTie) {
            gameStatus = `🤝 Game ended in a draw!`;
        } else {
            gameStatus = `🎲 Turn: @${room.game.currentTurn.split('@')[0]} (${room.game.currentTurn === room.game.playerX ? '❎' : '⭕'})`;
            mentions.push(room.game.currentTurn);
        }

        const str = `
🎮 *TicTacToe Game*

${gameStatus}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ Player ❎: @${room.game.playerX.split('@')[0]}
▢ Player ⭕: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? '• Type a number (1-9) to make your move\n• Type *surrender* to give up' : 'Game Over!'}
`;

        await sock.sendMessage(room.x, { 
            text: str,
            mentions: mentions
        }, { quoted: createFakeContact(message) });

        if (room.x !== room.o) {
            await sock.sendMessage(room.o, { 
                text: str,
                mentions: mentions
            }, { quoted: createFakeContact(message) });
        }

        if (winner || isTie) {
            delete games[room.id];
        }

    } catch (error) {
        console.error('Error in tictactoe move:', error);
        // Try to send error to the chat
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred during the move.' 
            }, { quoted: createFakeContact(message) });
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}

// Helper function to clean up old games periodically
function cleanupOldGames() {
    const now = Date.now();
    Object.keys(games).forEach(roomId => {
        if (games[roomId].id.startsWith('tictactoe')) {
            // Remove waiting games older than 5 minutes
            if (games[roomId].state === 'WAITING' && 
                (now - parseInt(roomId.split('-')[1])) > 300000) {
                delete games[roomId];
            }
            // Remove playing games that might be abandoned (no moves in 10 minutes)
            else if (games[roomId].state === 'PLAYING' && 
                     games[roomId].lastMove && 
                     (now - games[roomId].lastMove) > 600000) {
                delete games[roomId];
            }
        }
    });
}

// Run cleanup every minute
setInterval(cleanupOldGames, 60000);

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
