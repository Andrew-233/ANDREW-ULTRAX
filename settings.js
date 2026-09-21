
/**
* andrew x
* andrew x
*/

const settings = {
  packname: 'Andrew Tech',
  author: 'Andrew Tech',
  botName: "ANDREW-ULTRAX",
  botOwner: 'Andrew Tech', // Your name
  ownerNumber: process.env.OWNER_NUMBER || '255637518095', //Set your number here without + symbol, just add country code & number without any space
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq', // committed to git - rotate; set GIPHY_API_KEY in .env
  commandMode: "public",
  maxStoreMessages: 20, 
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "2.7.6",
  updateBranch: 'main',
  updateZipToken: '',
  updateZipUrl: "https://github.com/Andrew-233/Andrew-233/archive/refs/heads/main.zip",
  timezone: process.env.BOT_TIMEZONE || 'Africa/Accra',   // was 'Africa/nairobi'; Intl tolerates the bad case but moment-timezone throws on it
};

module.exports = settings;
