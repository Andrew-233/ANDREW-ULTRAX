const fs = require('fs');
const { createFakeContact } = require('../lib/fakeContact');

// Enhanced word list with categories
const wordCategories = {
    programming: ['javascript', 'python', 'nodejs', 'react', 'typescript', 'express', 'mongodb', 'algorithm'],
    animals: ['elephant', 'giraffe', 'kangaroo', 'dolphin', 'penguin', 'rhinoceros', 'octopus'],
    countries: ['australia', 'brazil', 'canada', 'denmark', 'egypt', 'finland', 'japan', 'mexico'],
    fruits: ['pineapple', 'strawberry', 'watermelon', 'blueberry', 'raspberry', 'pomegranate']
};

// Hangman ASCII art stages
const hangmanStages = [
    `
     -----
     |   |
         |
         |
         |
         |
    =======`,
    `
     -----
     |   |
     O   |
         |
         |
         |
    =======`,
    `
     -----
     |   |
     O   |
     |   |
         |
         |
    =======`,
    `
     -----
     |   |
     O   |
    /|   |
         |
         |
    =======`,
    `
     -----
     |   |
     O   |
    /|\\  |
         |
         |
    =======`,
    `
     -----
     |   |
     O   |
    /|\\  |
    /    |
         |
    =======`,
    `
     -----
     |   |
     O   |
    /|\\  |
    / \\  |
         |
    =======`
];

let hangmanGames = {};

function startHangman(sock, chatId, category = null) {
    // Choose a random category if none specified
    const selectedCategory = category && wordCategories[category] 
        ? category 
        : Object.keys(wordCategories)[Math.floor(Math.random() * Object.keys(wordCategories).length)];
    
    const wordList = wordCategories[selectedCategory];
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    
    const hints = generateHints(word, selectedCategory);
    
    hangmanGames[chatId] = {
        word: word.toLowerCase(),
        maskedWord: '_ '.repeat(word.length).trim().split(' '),
        guessedLetters: [],
        wrongGuesses: 0,
        maxWrongGuesses: 6,
        category: selectedCategory,
        hints: hints,
        hintUsed: false,
        score: 0,
        startTime: Date.now()
    };
    
    const gameInfo = `🎮 *Hangman Game Started!*\n\n` +
                     `📁 Category: *${selectedCategory.toUpperCase()}*\n` +
                     `📝 Word: ${hangmanGames[chatId].maskedWord.join(' ')}\n` +
                     `💡 Hint available: Type .hint\n` +
                     `🔤 Letters left: ${getAvailableLetters(hangmanGames[chatId])}\n` +
                     `⏱️ Time limit: 5 minutes`;
    
    sock.sendMessage(chatId, { text: gameInfo }, { quoted: createFakeContact(message) });
    
    // Add timeout for game
    setTimeout(() => {
        if (hangmanGames[chatId]) {
            sock.sendMessage(chatId, { 
                text: `⏰ Time's up! The word was: *${hangmanGames[chatId].word}*` 
            }, { quoted: createFakeContact(message) });
            delete hangmanGames[chatId];
        }
    }, 5 * 60 * 1000); // 5 minutes
}

function generateHints(word, category) {
    const hints = [];
    
    // Add category hint
    hints.push(`Category: ${category}`);
    
    // Add length hint
    hints.push(`The word has ${word.length} letters`);
    
    // Add first and last letter hint
    if (word.length > 2) {
        hints.push(`Starts with: ${word[0].toUpperCase()}`);
        hints.push(`Ends with: ${word[word.length - 1].toUpperCase()}`);
    }
    
    // Add vowel hint
    const vowels = word.match(/[aeiou]/gi);
    if (vowels) {
        hints.push(`Contains ${vowels.length} vowel(s)`);
    }
    
    return hints;
}

function getAvailableLetters(game) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const available = [];
    
    for (let letter of alphabet) {
        if (!game.guessedLetters.includes(letter)) {
            available.push(letter);
        }
    }
    
    return available.join(' ');
}

function getHangmanDrawing(wrongGuesses) {
    return hangmanStages[wrongGuesses] || hangmanStages[0];
}

function guessLetter(sock, chatId, letter) {
    if (!hangmanGames[chatId]) {
        sock.sendMessage(chatId, { 
            text: 'No active game! Start a new one with: .hangman [category]\nCategories: ' + Object.keys(wordCategories).join(', ') 
        }, { quoted: createFakeContact(message) });
        return;
    }

    const game = hangmanGames[chatId];
    const { word, guessedLetters, maskedWord } = game;
    
    letter = letter.toLowerCase();
    
    // Validate input
    if (letter.length !== 1 || !letter.match(/[a-z]/i)) {
        sock.sendMessage(chatId, { text: '❌ Please enter a single letter (A-Z)' }, { quoted: createFakeContact(message) });
        return;
    }
    
    if (guessedLetters.includes(letter)) {
        sock.sendMessage(chatId, { text: `⚠️ You already guessed "${letter.toUpperCase()}"` }, { quoted: createFakeContact(message) });
        return;
    }
    
    guessedLetters.push(letter);
    
    if (word.includes(letter)) {
        let correctPositions = [];
        for (let i = 0; i < word.length; i++) {
            if (word[i] === letter) {
                maskedWord[i] = letter;
                correctPositions.push(i + 1);
            }
        }
        
        // Calculate score bonus
        game.score += 10 * correctPositions.length;
        
        const message = `✅ *Correct!* Letter "${letter.toUpperCase()}" appears ${correctPositions.length} time(s)\n\n` +
                       `📝 ${maskedWord.join(' ')}\n` +
                       `⭐ Score: ${game.score}\n` +
                       `🔤 Available: ${getAvailableLetters(game)}\n` +
                       getHangmanDrawing(game.wrongGuesses);
        
        sock.sendMessage(chatId, { text: message }, { quoted: createFakeContact(message) });
        
        if (!maskedWord.includes('_')) {
            // Calculate final score with time bonus
            const timeTaken = Date.now() - game.startTime;
            const timeBonus = Math.max(0, 300 - Math.floor(timeTaken / 1000)); // 5 minutes max
            game.score += timeBonus * 5;
            
            const winMessage = `🎉 *You Won!*\n\n` +
                              `🏆 Word: *${word.toUpperCase()}*\n` +
                              `⭐ Score: ${game.score}\n` +
                              `⏱️ Time: ${Math.floor(timeTaken / 1000)}s\n` +
                              `❌ Wrong guesses: ${game.wrongGuesses}\n` +
                              `🔤 Total guesses: ${game.guessedLetters.length}`;
            
            sock.sendMessage(chatId, { text: winMessage }, { quoted: createFakeContact(message) });
            delete hangmanGames[chatId];
        }
    } else {
        game.wrongGuesses += 1;
        game.score = Math.max(0, game.score - 5); // Penalty for wrong guess
        
        const remainingAttempts = game.maxWrongGuesses - game.wrongGuesses;
        const message = `❌ *Wrong guess!*\n\n` +
                       `📝 ${maskedWord.join(' ')}\n` +
                       `⚠️ Attempts left: ${remainingAttempts}\n` +
                       `⭐ Score: ${game.score}\n` +
                       `🔤 Available: ${getAvailableLetters(game)}\n` +
                       getHangmanDrawing(game.wrongGuesses);
        
        sock.sendMessage(chatId, { text: message }, { quoted: createFakeContact(message) });
        
        if (game.wrongGuesses >= game.maxWrongGuesses) {
            const loseMessage = `💀 *Game Over!*\n\n` +
                               `📛 The word was: *${word.toUpperCase()}*\n` +
                               `⭐ Final Score: ${game.score}\n` +
                               `🔤 Guessed letters: ${game.guessedLetters.map(l => l.toUpperCase()).join(', ')}`;
            
            sock.sendMessage(chatId, { text: loseMessage }, { quoted: createFakeContact(message) });
            delete hangmanGames[chatId];
        }
    }
}

function giveHint(sock, chatId) {
    if (!hangmanGames[chatId]) {
        sock.sendMessage(chatId, { text: 'No active game!' }, { quoted: createFakeContact(message) });
        return;
    }
    
    const game = hangmanGames[chatId];
    
    if (game.hintUsed) {
        sock.sendMessage(chatId, { text: 'You already used your hint!' }, { quoted: createFakeContact(message) });
        return;
    }
    
    game.hintUsed = true;
    game.score = Math.max(0, game.score - 15); // Hint penalty
    
    // Give a random hint
    const hint = game.hints[Math.floor(Math.random() * game.hints.length)];
    
    sock.sendMessage(chatId, { 
        text: `💡 *Hint:* ${hint}\n⭐ Score penalty: -15 points\nCurrent score: ${game.score}` 
    });
}

function showGameStatus(sock, chatId) {
    if (!hangmanGames[chatId]) {
        sock.sendMessage(chatId, { text: 'No active game!' }, { quoted: createFakeContact(message) });
        return;
    }
    
    const game = hangmanGames[chatId];
    const timeElapsed = Math.floor((Date.now() - game.startTime) / 1000);
    
    const status = `🎮 *Game Status*\n\n` +
                  `📁 Category: ${game.category.toUpperCase()}\n` +
                  `📝 Word: ${game.maskedWord.join(' ')}\n` +
                  `⭐ Score: ${game.score}\n` +
                  `❌ Wrong guesses: ${game.wrongGuesses}/${game.maxWrongGuesses}\n` +
                  `🔤 Guessed: ${game.guessedLetters.map(l => l.toUpperCase()).join(', ') || 'None'}\n` +
                  `⏱️ Time: ${timeElapsed}s\n` +
                  `💡 Hint available: ${!game.hintUsed ? 'Yes' : 'Used'}\n` +
                  getHangmanDrawing(game.wrongGuesses);
    
    sock.sendMessage(chatId, { text: status }, { quoted: createFakeContact(message) });
}

function showLeaderboard(sock, chatId) {
    // In a real implementation, you'd store scores in a database
    // For now, we'll show a placeholder
    sock.sendMessage(chatId, { 
        text: `🏆 *Leaderboard*\n\n` +
              `1. 🥇 Player1: 250 points\n` +
              `2. 🥈 Player2: 180 points\n` +
              `3. 🥉 Player3: 150 points\n\n` +
              `*Play more games to appear on the leaderboard!*` 
    }, { quoted: createFakeContact(message) });
}

function endGame(sock, chatId) {
    if (!hangmanGames[chatId]) {
        sock.sendMessage(chatId, { text: 'No active game to end!' }, { quoted: createFakeContact(message) });
        return;
    }
    
    const game = hangmanGames[chatId];
    const message = `🏁 *Game ended*\n\n` +
                   `The word was: *${game.word.toUpperCase()}*\n` +
                   `⭐ Final score: ${game.score}`;
    
    sock.sendMessage(chatId, { text: message }, { quoted: createFakeContact(message) });
    delete hangmanGames[chatId];
}

module.exports = { 
    startHangman, 
    guessLetter, 
    giveHint,
    showGameStatus,
    showLeaderboard,
    endGame,
    wordCategories: Object.keys(wordCategories) // Export available categories
};
