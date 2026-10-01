const WORD_LIST = [
    // Animals
    'elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'crocodile', 'flamingo', 'cheetah', 'jaguar', 'gorilla',
    // Countries
    'nigeria', 'brazil', 'canada', 'germany', 'portugal', 'australia', 'malaysia', 'ukraine', 'denmark', 'finland',
    // Tech
    'keyboard', 'internet', 'database', 'software', 'wireless', 'password', 'firewall', 'network', 'browser', 'monitor',
    // Food
    'chocolate', 'pancakes', 'avocado', 'spaghetti', 'broccoli', 'tortilla', 'cheddar', 'muffin', 'caramel', 'custard',
    // Sports
    'football', 'swimming', 'marathon', 'gymnastics', 'badminton', 'wrestling', 'volleyball', 'archery', 'cycling', 'surfing',
    // Nature
    'mountain', 'waterfall', 'thunderstorm', 'volcano', 'glacier', 'rainbow', 'hurricane', 'tornado', 'avalanche', 'earthquake'
];

const activeGames = {};
const BOT_SOLVE_DELAY = 25 * 1000;

function scrambleWord(word) {
    const arr = word.split('');
    let scrambled;
    let attempts = 0;
    do {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        scrambled = arr.join('');
        attempts++;
    } while (scrambled === word && attempts < 20);
    return scrambled;
}

async function startScramble(sock, chatId, senderId, mode) {
    if (activeGames[chatId]) {
        const g = activeGames[chatId];
        return sock.sendMessage(chatId, {
            text: `⚠️ A game is already active!\n\n🔀 *Scrambled:* \`${g.scrambled.toUpperCase()}\`\n\n_Type the correct word to win! Use *.endscramble* to stop._`
        });
    }

    const isBotMode = (mode || '').toLowerCase() === 'bot';
    const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const scrambled = scrambleWord(word);

    const game = {
        word,
        scrambled,
        startTime: Date.now(),
        vsBot: isBotMode,
        players: {}
    };
    activeGames[chatId] = game;

    await sock.sendMessage(chatId, {
        text: `🔀 *Word Scramble${isBotMode ? ' (Solo)' : ' (Multiplayer)'}*\n\n` +
              `Unscramble this word:\n\n` +
              `🔡 *${scrambled.toUpperCase()}*\n\n` +
              `_Type your answer in chat to win!_\n` +
              `⏱️ Time limit: 30 seconds\n` +
              `❌ Use *.endscramble* to stop`
    });

    // Auto-reveal after 30 seconds
    game.timeout = setTimeout(async () => {
        if (!activeGames[chatId]) return;
        await sock.sendMessage(chatId, {
            text: `⏰ *Time's up!*\n\nThe word was: *${word.toUpperCase()}*\n\n_Start a new game with *.scramble*_`
        }).catch(() => {});
        delete activeGames[chatId];
    }, 30 * 1000);

    // Bot solves after delay (in bot mode, bot "competes" too — just demonstrates the answer)
    if (!isBotMode) {
        game.botTimeout = setTimeout(async () => {
            if (!activeGames[chatId]) return;
            // Bot doesn't solve in multiplayer — just a time limit
        }, BOT_SOLVE_DELAY);
    }
}

async function handleScrambleGuess(sock, chatId, senderId, text) {
    const game = activeGames[chatId];
    if (!game) return false;

    const guess = text.trim().toLowerCase();
    if (guess !== game.word) return false;

    clearTimeout(game.timeout);
    if (game.botTimeout) clearTimeout(game.botTimeout);

    const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(1);
    const playerName = `@${senderId.split('@')[0]}`;

    await sock.sendMessage(chatId, {
        text: `🎉 *${playerName} got it!*\n\n✅ The word was: *${game.word.toUpperCase()}*\n⏱️ Time: ${timeTaken}s\n\n_Start a new game with *.scramble*_`,
        mentions: [senderId]
    });

    delete activeGames[chatId];
    return true;
}

async function endScramble(sock, chatId) {
    const game = activeGames[chatId];
    if (!game) return sock.sendMessage(chatId, { text: '❌ No active Word Scramble game.' });
    clearTimeout(game.timeout);
    if (game.botTimeout) clearTimeout(game.botTimeout);
    await sock.sendMessage(chatId, {
        text: `🏁 *Game Ended*\n\nThe word was: *${game.word.toUpperCase()}*`
    });
    delete activeGames[chatId];
}

module.exports = { startScramble, handleScrambleGuess, endScramble };
