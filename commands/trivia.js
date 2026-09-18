const axios = require('axios');

let triviaGames = {};

const { createFakeContact } = require('../lib/fakeContact');
async function startTrivia(sock, chatId) {
    if (triviaGames[chatId]) {
        sock.sendMessage(chatId, { text: 'A trivia game is already in progress!' }, { quoted: createFakeContact(message) });
        return;
    }

    try {
        const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
        const questionData = response.data.results[0];

        triviaGames[chatId] = {
            question: questionData.question,
            correctAnswer: questionData.correct_answer,
            options: [...questionData.incorrect_answers, questionData.correct_answer].sort(),
        };

        sock.sendMessage(chatId, {
            text: `Trivia Time!\n\nQuestion: ${triviaGames[chatId].question}\nOptions:\n${triviaGames[chatId].options.join('\n')}`
        });
    } catch (error) {
        sock.sendMessage(chatId, { text: 'Error fetching trivia question. Try again later.' }, { quoted: createFakeContact(message) });
    }
}

function answerTrivia(sock, chatId, answer) {
    if (!triviaGames[chatId]) {
        sock.sendMessage(chatId, { text: 'No trivia game is in progress.' }, { quoted: createFakeContact(message) });
        return;
    }

    const game = triviaGames[chatId];

    if (answer.toLowerCase() === game.correctAnswer.toLowerCase()) {
        sock.sendMessage(chatId, { text: `Correct! The answer is ${game.correctAnswer}` }, { quoted: createFakeContact(message) });
    } else {
        sock.sendMessage(chatId, { text: `Wrong! The correct answer was ${game.correctAnswer}` }, { quoted: createFakeContact(message) });
    }

    delete triviaGames[chatId];
}

module.exports = { startTrivia, answerTrivia };
