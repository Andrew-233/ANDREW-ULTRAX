const eightBallResponses = [
    "Yes, definitely!",
    "No way!",
    "Ask again later.",
    "It is certain.",
    "Very doubtful.",
    "Without a doubt.",
    "My reply is no.",
    "Signs point to yes."
];

const { createFakeContact } = require('../lib/fakeContact');
async function eightBallCommand(sock, chatId, question) {
    if (!question) {
        await sock.sendMessage(chatId, { text: 'Please ask a question!' }, { quoted: createFakeContact(message) });
        return;
    }

    const randomResponse = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
    await sock.sendMessage(chatId, { text: `🎱 ${randomResponse}` }, { quoted: createFakeContact(message) });
}

module.exports = { eightBallCommand };
