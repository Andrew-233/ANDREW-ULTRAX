const settings = require('../settings');

const channelInfo = {
  contextInfo: {
    forwardingScore: 999,
    isForwarded: false,
    forwardedNewsletterMessageInfo: {
      newsletterJid: settings.newsletterJid,
      newsletterName: settings.newsletterName,
      serverMessageId: -1,
    }
  }
};

module.exports = {
  channelInfo
};;
