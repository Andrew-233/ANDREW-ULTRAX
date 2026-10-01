/**
 * Andrew x Bot - settings
 * Everything is configured here. The only environment variable used is SESSION_ID (.env).
 */

require('dotenv').config();

const repositoryUrl = 'https://github.com/Andrew-233/ANDREW-ULTRAX';
const newsletterJid = '120363366284524544@newsletter';

module.exports = {
  botName: 'Andrew x Bot',
  botOwner: 'Andrew Dev',
  // Developer's number (digits only, with country code). It is the default owner
  // until the owner is changed with .setownernumber
  developerNumber: '',
  prefix: '.',
  commandMode: 'public',
  version: '2.7.6',
  timezone: 'Africa/Nairobi',

  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq', // used by .gif

  repositoryUrl,
  repositoryApiUrl: 'https://api.github.com/repos/Andrew-233/ANDREW-ULTRAX',
  updateBranch: 'main',
  updateZipUrl: `${repositoryUrl}/archive/refs/heads/main.zip`,

  newsletterJid,
  newsletterName: 'Andrew Nexus Tech',
  channelLink: `https://whatsapp.com/channel/${newsletterJid.replace('@newsletter', '')}`,
};
