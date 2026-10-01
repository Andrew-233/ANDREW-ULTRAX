const { jidDecode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');

const lidPhoneCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function resolvePhoneFromLid(lidNumber) {
    if (!lidNumber) return null;

    const cached = lidPhoneCache.get(lidNumber);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.value;
    }

    try {
        const reverseFile = path.join(SESSION_DIR, `lid-mapping-${lidNumber}_reverse.json`);
        if (fs.existsSync(reverseFile)) {
            const phoneNumber = JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
            if (typeof phoneNumber === 'string' && phoneNumber.length > 0) {
                lidPhoneCache.set(lidNumber, { value: phoneNumber, ts: Date.now() });
                return phoneNumber;
            }
        }
    } catch (e) {}

    lidPhoneCache.set(lidNumber, { value: null, ts: Date.now() });
    return null;
}

function resolveLidFromPhone(phoneNumber) {
    if (!phoneNumber) return null;

    try {
        const mapFile = path.join(SESSION_DIR, `lid-mapping-${phoneNumber}.json`);
        if (fs.existsSync(mapFile)) {
            const lidNumber = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
            if (typeof lidNumber === 'string' && lidNumber.length > 0) {
                return lidNumber;
            }
        }
    } catch (e) {}

    return null;
}

function normalizeJid(jid) {
    if (!jid || typeof jid !== 'string') return jid;
    jid = jid.trim();
    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid) || {};
        if (decoded.user && decoded.server) {
            return `${decoded.user}@${decoded.server}`;
        }
    }
    return jid;
}

function isLid(jid) {
    if (!jid || typeof jid !== 'string') return false;
    return jid.endsWith('@lid');
}

function extractNumber(jid) {
    if (!jid || typeof jid !== 'string') return '';
    return jid.split('@')[0].split(':')[0];
}

function compareJids(a, b) {
    if (!a || !b) return false;
    const normA = normalizeJid(a);
    const normB = normalizeJid(b);
    if (normA === normB) return true;

    const numA = extractNumber(normA);
    const numB = extractNumber(normB);
    if (numA && numB && numA === numB) return true;

    const aIsLid = isLid(normA);
    const bIsLid = isLid(normB);

    if (aIsLid && !bIsLid) {
        const phoneA = resolvePhoneFromLid(numA);
        const phoneBNum = numB;
        if (phoneA && phoneBNum && phoneA === phoneBNum) return true;
    }

    if (bIsLid && !aIsLid) {
        const phoneB = resolvePhoneFromLid(numB);
        const phoneANum = numA;
        if (phoneB && phoneANum && phoneB === phoneANum) return true;
    }

    if (aIsLid && bIsLid) {
        return false;
    }

    return false;
}

function findParticipant(participants, targetJid) {
    if (!participants || !targetJid) return null;
    const normalized = normalizeJid(targetJid);
    return participants.find(p => {
        const pid = normalizeJid(p.id);
        return compareJids(pid, normalized);
    }) || null;
}

function toUserJid(number) {
    if (!number) return '';
    const clean = number.toString().replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
}


/**
 * Resolve any JID (WhatsApp ID) into a proper phone JID.
 * Handles cases like device JIDs, agent JIDs, and colon-prefixed IDs.
 *
 * @param {string} jid - The raw JID string
 * @returns {string|null} - Normalized phone JID or null if invalid
 */

function resolveToPhoneJid(jid) {
    if (!jid || typeof jid !== 'string') return null;

    // Strip device/agent suffixes like ":1@s.whatsapp.net"
    const base = jid.split('@')[0].split(':')[0];

    // If already a phone number JID
    if (jid.endsWith('@s.whatsapp.net')) {
        return `${base}@s.whatsapp.net`;
    }

    // Handle group JIDs separately (return unchanged)
    if (jid.endsWith('@g.us')) {
        return jid;
    }

    // Default: assume it's a phone number
    if (/^\d+$/.test(base)) {
        return `${base}@s.whatsapp.net`;
    }

    // If it doesn’t look like a number, return original
    return jid;
}


module.exports = { normalizeJid, isLid, extractNumber, compareJids, findParticipant, toUserJid, resolvePhoneFromLid, 
    resolveToPhoneJid, resolveLidFromPhone };
