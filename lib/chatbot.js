'use strict';

const axios = require('axios');

const CREATOR_NAME    = '*𓆩ᯓ𝑨𝑵𝑫𝑹𝑬𝑾 𝑿 『Dev』⎯꯭̽𓆪';
const CREATOR_NUMBER  = '+233592098519';
const CREATOR_CONTACT = `${CREATOR_NAME} — ${CREATOR_NUMBER}`;
const BOT_NAME        = 'Andrew x';
const BOT_VERSION     = 'v3.0.0';

const QUICK_REPLIES = {
  'hi': 'Hey! 👋 What\'s up?',
  'hello': 'Hello there! 😊 How can I help?',
  'hey': 'Hey! 😄 What\'s good?',
  'hii': 'Hey!! 😄 What\'s up?',
  'how are you': 'I\'m doing great, thanks for asking! 🤖✨',
  'how r u': 'All good here! 😊 How about you?',
  'what is your name': `I'm *${BOT_NAME}* ${BOT_VERSION} — your personal WhatsApp assistant! 🚀`,
  'whats your name': `I'm *${BOT_NAME}*! 🤖 Built by *${CREATOR_NAME}*.`,
  'your name': `My name is *${BOT_NAME}*! 🤖`,
  'who are you': `I'm *${BOT_NAME}* ${BOT_VERSION} — an AI-powered WhatsApp bot built by *${CREATOR_NAME}*! 🤖`,
  'who made you': `I was built by *${CREATOR_NAME}* 🔥\n📞 ${CREATOR_NUMBER}`,
  'who created you': `I was created by *${CREATOR_NAME}* 💻\n📞 ${CREATOR_NUMBER}`,
  'who is your creator': `My creator is *${CREATOR_NAME}* 👨‍💻\n📞 ${CREATOR_NUMBER}`,
  'who is your developer': `My developer is *${CREATOR_NAME}* 👨‍💻\n📞 ${CREATOR_NUMBER}`,
  'who developed you': `*${CREATOR_NAME}* developed me! 💻\n📞 ${CREATOR_NUMBER}`,
  'who is your owner': `My owner/developer is *${CREATOR_NAME}*\n📞 ${CREATOR_NUMBER}`,
  'who built you': `Built by *${CREATOR_NAME}* 🔥\n📞 ${CREATOR_NUMBER}`,
  'who programmed you': `Programmed by *${CREATOR_NAME}* 👨‍💻\n📞 ${CREATOR_NUMBER}`,
  'developer': `My developer is *${CREATOR_NAME}*\n📞 ${CREATOR_NUMBER}`,
  'developer number': `📞 Reach my developer *${CREATOR_NAME}* at ${CREATOR_NUMBER}`,
  'creator number': `📞 Creator contact: *${CREATOR_NAME}* — ${CREATOR_NUMBER}`,
  'creator': `My creator is *${CREATOR_NAME}*\n📞 ${CREATOR_NUMBER}`,
  'contact developer': `📞 You can reach my developer *${CREATOR_NAME}* at ${CREATOR_NUMBER}`,
  'contact creator': `📞 Creator: *${CREATOR_NAME}* — ${CREATOR_NUMBER}`,
  'your developer': `My developer is *${CREATOR_NAME}*\n📞 ${CREATOR_NUMBER}`,
  'your creator': `My creator is *${CREATOR_NAME}*\n📞 ${CREATOR_NUMBER}`,
  'dave x': `Yes! *Dave X* is my creator and developer 👨‍💻\n📞 ${CREATOR_NUMBER}`,
  'davex': `*Dave X* built me — I'm *${BOT_NAME}* ${BOT_VERSION}! 🚀`,
  'version': `I'm *${BOT_NAME}* ${BOT_VERSION} 🤖`,
  'what version': `Running *${BOT_NAME}* ${BOT_VERSION} 🚀`,
  'what can you do': 'I can chat, make stickers, download media, answer questions, manage groups and more! 🎯',
  'thanks': 'You\'re welcome! 😊',
  'thank you': 'Anytime! Happy to help! 😄',
  'thx': 'No problem! 😊',
  'bye': 'Goodbye! 👋 Take care!',
  'good bye': 'Goodbye! 👋 Stay safe!',
  'good morning': 'Good morning! ☀️ Hope you have a wonderful day!',
  'good night': 'Good night! 🌙 Sleep well!',
  'good afternoon': 'Good afternoon! 🌤️ How\'s your day going?',
  'good evening': 'Good evening! 🌆 How was your day?',
  'ok': 'Okay! 👍',
  'okay': 'Alright! 😊',
  'cool': 'Yes indeed! 😎',
  'nice': 'Thanks! 😊',
  'wow': 'I know right! 😄',
  'lol': '😂😂',
  'haha': '😄 That\'s funny!',
};

// ─── Scrub API responses that claim wrong creator info ────────────────────────
const WRONG_CREATOR_PATTERNS = [
  /\bkeith\b/gi,
  /apiskeith/gi,
  /created by.*?(openai|google|anthropic|meta|microsoft)/gi,
  /made by.*?(openai|google|anthropic|meta|microsoft)/gi,
  /i('m| am) (chat)?gpt/gi,
  /i('m| am) (google )?gemini/gi,
  /i('m| am) claude/gi,
  /i('m| am) (an? )?ai (language )?model/gi,
  /i('m| am) (an? )?language model/gi,
];

function sanitizeApiReply(text) {
  if (!text) return text;
  let out = text;
  for (const pat of WRONG_CREATOR_PATTERNS) {
    if (pat.test(out)) {
      return `I'm *${BOT_NAME}* ${BOT_VERSION}, built by *${CREATOR_NAME}* (${CREATOR_NUMBER}) 🤖`;
    }
  }
  return out;
}

// ============================
// WORKING APIs (DrexApp + Gifted + PrexzyVilla)
// ============================

// DrexApp GPT (working)
async function tryDrexAppGPT(text) {
  try {
    const res = await axios.get(
      `https://api.drexapp.space/ai/gpt?text=${encodeURIComponent(text)}`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.status && r?.result && typeof r.result === 'string' && r.result.trim().length > 1) {
      return r.result.trim();
    }
    return null;
  } catch { return null; }
}

// GiftedTech ChatGPT
async function tryGiftedGPT(text) {
  try {
    const res = await axios.get(
      `https://api.giftedtech.co.ke/api/ai/chatgpt?apikey=gifted&text=${encodeURIComponent(text)}`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.result && typeof r.result === 'string' && r.result.trim().length > 1) return r.result.trim();
    return null;
  } catch { return null; }
}

// GiftedTech GPT4
async function tryGiftedGPT4(text) {
  try {
    const res = await axios.get(
      `https://api.giftedtech.co.ke/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(text)}`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.result && typeof r.result === 'string' && r.result.trim().length > 1) return r.result.trim();
    return null;
  } catch { return null; }
}

// PrexzyVilla GPT-5
async function tryPrexzyGPT5(text) {
  try {
    const res = await axios.get(
      `https://apis.prexzyvilla.site/ai/gpt-5?text=${encodeURIComponent(text)}`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.status && r?.text && typeof r.text === 'string' && r.text.trim().length > 1) {
      return r.text.trim();
    }
    return null;
  } catch { return null; }
}

// BK9 OpenAI
async function tryBK9(text) {
  try {
    const res = await axios.get(
      `https://api.bk9.dev/ai/openai?q=${encodeURIComponent(text)}`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.BK9 && typeof r.BK9 === 'string' && r.BK9.trim().length > 1) return r.BK9.trim();
    if (r?.result && typeof r.result === 'string' && r.result.trim().length > 1) return r.result.trim();
    return null;
  } catch { return null; }
}

// Siputzx GPT3
async function trySiputzxGPT(text) {
  try {
    const res = await axios.get(
      `https://api.siputzx.my.id/api/ai/gpt3?prompt=${encodeURIComponent(text)}&content=user`,
      { timeout: 15000 }
    );
    const r = res.data;
    if (r?.data && typeof r.data === 'string' && r.data.trim().length > 1) return r.data.trim();
    if (r?.result && typeof r.result === 'string' && r.result.trim().length > 1) return r.result.trim();
    return null;
  } catch { return null; }
}

// SimSimi (fallback)
async function trySimSimi(text) {
  try {
    const res = await axios.get(
      `https://api.simsimi.vn/v1/simsimi?text=${encodeURIComponent(text)}&lc=en`,
      { timeout: 8000 }
    );
    const r = res.data;
    if (r?.success && r?.message && typeof r.message === 'string') return r.message.trim();
    return null;
  } catch { return null; }
}

// ─── Creator question detector ────────────────────────────────────────────────
const CREATOR_TRIGGERS = [
  /who('s| is| are)? ?(your|the)? ?(creator|developer|owner|maker|programmer|coder|author)/i,
  /who (made|built|created|programmed|developed|wrote|coded) (you|this bot|davex)/i,
  /tell me about (your|the) (creator|developer|owner)/i,
  /(creator|developer|owner|maker)('s)? (number|contact|phone|whatsapp)/i,
  /contact (your|the) (creator|developer|owner)/i,
  /how (can i|do i|to) (contact|reach|find) (your|the) (creator|developer|owner)/i,
  /dave\s*x/i,
];

function isCreatorQuestion(lower) {
  return CREATOR_TRIGGERS.some(r => r.test(lower));
}

const SMART_REPLIES = [
  (t) => t.includes('weather') ? '☁️ I can\'t check live weather right now — try weather.com or Google!' : null,
  (t) => t.includes('joke') ? [
    'Why don\'t scientists trust atoms? Because they make up everything! 😂',
    'I told my wife she should embrace her mistakes. She gave me a hug! 😄',
    'Why do programmers prefer dark mode? Because light attracts bugs! 🐛😂',
    'I asked the librarian if they had books on paranoia — she whispered "they\'re right behind you!" 😂'
  ][Math.floor(Math.random() * 4)] : null,
  (t) => (t.includes('love') || t.includes('i love you')) ? '❤️ Aww, that\'s sweet! Love you too (in a bot way 🤖💕)!' : null,
  (t) => (t.includes('sad') || t.includes('depressed') || t.includes('unhappy')) ? '💙 I\'m sorry to hear that. Remember — tough times never last. You\'ve got this! 💪' : null,
  (t) => (t.includes('time') || t === 'what time') ? `🕐 It's ${new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi' })} (EAT)` : null,
  (t) => (t.includes('date') || t === 'what date') ? `📅 Today is ${new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' })}` : null,
];

async function getReply(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // Exact / prefix / suffix match on QUICK_REPLIES
  for (const [key, val] of Object.entries(QUICK_REPLIES)) {
    if (lower === key || lower.startsWith(key + ' ') || lower.endsWith(' ' + key)) return val;
  }

  // Sentence-level creator question detection — always answered locally, never via API
  if (isCreatorQuestion(lower)) {
    return `My creator and developer is *${CREATOR_NAME}* 👨‍💻\n📞 ${CREATOR_NUMBER}\n\nI'm *${BOT_NAME}* ${BOT_VERSION} — built with ❤️ by Dave X.`;
  }

  for (const fn of SMART_REPLIES) {
    const r = fn(lower);
    if (r) return r;
  }

  // External AI APIs (working only) — all responses sanitized before returning
  let reply = null;
  try { reply = await tryDrexAppGPT(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await tryPrexzyGPT5(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await tryGiftedGPT(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await tryGiftedGPT4(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await tryBK9(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await trySiputzxGPT(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}
  try { reply = await trySimSimi(text); if (reply) { reply = sanitizeApiReply(reply); return reply; } } catch (_) {}

  return '🤖 Sorry, I couldn\'t get a reply right now. Try again in a moment!';
}

module.exports = { getReply };
