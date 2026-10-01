/*by supreme*/
const os = require('os');
const { getBotName } = require('../lib/botConfig');

async function pCommand( sock, chatId, message ) {
  try {
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: '*🔹pong!...*'},{ quoted: message
    });

    const ping = Date.now() - start;
    const response = `*🔸${getBotName()} speed🔹:* ${ping} ms`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key// Edit the original message
    });   
    
  } catch (error) {
    console.error('Ping error:', error);
    await sock.sendMessage(chatId, { text: 'Failed to measure speed.' });
  }
}

module.exports = pCommand;
