// devReact.js
// Reacts with 👑 even if someone already reacted with the same emoji.

const { getOwnerNumber } = require('../lib/botConfig');

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid) return "";
  const local = jid.split("@")[0];
  return local.replace(/\D/g, "");
}

function isOwnerNumber(num) {
  const owner = String(getOwnerNumber() || "").replace(/\D/g, "");
  if (!owner || !num) return false;
  return num === owner || num.endsWith(owner);
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg?.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");

    const rawSender = isGroup ? msg.key.participant : msg.key.remoteJid;
    const digits = normalizeJidToDigits(rawSender);

    if (!isOwnerNumber(digits)) return;

    // 1️⃣ Remove any existing reaction
    await sock.sendMessage(remoteJid, {
      react: { text: "", key: msg.key }
    });

    // 2️⃣ Now send your reaction (guaranteed to show)
    await sock.sendMessage(remoteJid, {
      react: { text: EMOJI, key: msg.key }
    });

  } catch {}
}

module.exports = { handleDevReact };
