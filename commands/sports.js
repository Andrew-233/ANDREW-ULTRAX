const axios = require('axios');
const { BASE_API } = require('../lib/apiConfig');
const { createFakeContact } = require('../lib/fakeContact');

const TIMEOUT = 20000;

async function get(path) {
    const { data } = await axios.get(`${BASE_API}${path}`, { timeout: TIMEOUT });
    return data;
}

// ─── LEAGUE CONFIG ────────────────────────────────────────────────────────────
const LEAGUES = {
    epl:         { slug: 'epl',         label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 EPL' },
    laliga:      { slug: 'laliga',      label: '🇪🇸 La Liga' },
    ucl:         { slug: 'ucl',         label: '🏆 UCL' },
    bundesliga:  { slug: 'bundesliga',  label: '🇩🇪 Bundesliga' },
    seriea:      { slug: 'seriea',      label: '🇮🇹 Serie A' },
    euros:       { slug: 'euros',       label: '🇪🇺 Euros' },
    fifa:        { slug: 'fifa',        label: '🌍 FIFA' },
};

// ─── FORMATTERS ───────────────────────────────────────────────────────────────

// Null-safe team name — strips " FC" suffix, falls back to "TBD"
function tn(name) {
    return name ? name.replace(' FC', '') : 'TBD';
}

function formatStandings(data) {
    const { competition, standings } = data.result;
    const rows = standings
        .filter(t => t.team !== null)
        .slice(0, 10)
        .map(t =>
            `${String(t.position).padStart(2)}. ${tn(t.team)} — *${t.points}pts* (${t.won}W ${t.draw}D ${t.lost}L | GD:${t.goalDifference > 0 ? '+' : ''}${t.goalDifference})`
        ).join('\n');
    if (!rows) return `⚠️ ${competition} standings are not available yet.`;
    return `┏━━━✧ ${competition} STANDINGS ✧━━━\n${rows}\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatScorers(data) {
    const { competition, topScorers } = data.result;
    const rows = (topScorers || [])
        .filter(p => p.player !== null)
        .slice(0, 10)
        .map(p =>
            `${String(p.rank).padStart(2)}. *${p.player || 'Unknown'}* (${tn(p.team)}) — ⚽${p.goals} | 🅰️${p.assists !== 'N/A' ? p.assists : 0}`
        ).join('\n');
    if (!rows) return `⚠️ ${competition} scorer data is not available yet.`;
    return `┏━━━✧ ${competition} TOP SCORERS ✧━━━\n${rows}\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatUpcoming(data) {
    const { competition, upcomingMatches } = data.result;
    const rows = (upcomingMatches || []).slice(0, 8).map(m => {
        const d = new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `📅 ${d}\n   ${tn(m.homeTeam)} *vs* ${tn(m.awayTeam)}`;
    }).join('\n');
    if (!rows) return `⚠️ No upcoming ${competition} matches found.`;
    return `┏━━━✧ ${competition} UPCOMING ✧━━━\n${rows}\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatLivescore(data) {
    const games = Object.values(data.result?.games || {});
    if (!games.length) return '⚽ No live matches right now.';
    const rows = games.slice(0, 10).map(g => {
        const status = g.R?.st || '?';
        const score = (g.R?.r1 !== undefined) ? `${g.R.r1} - ${g.R.r2}` : '? - ?';
        return `🔵 *${g.p1 || 'TBD'}* ${score} *${g.p2 || 'TBD'}*  [${status}]`;
    }).join('\n');
    return `┏━━━✧ ⚽ LIVE SCORES ✧━━━━━━\n${rows}\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatBetTips(data) {
    const tips = data.result.slice(0, 6);
    const rows = tips.map(t => {
        const ft = t.predictions?.fulltime;
        const o25 = t.predictions?.over_2_5;
        const btts = t.predictions?.bothTeamToScore;
        return (
            `🏟 *${t.match}* (${t.league})\n` +
            `   🕐 ${new Date(t.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n` +
            (ft ? `   1X2: H${ft.home}% D${ft.draw}% A${ft.away}%\n` : '') +
            (o25 ? `   Over 2.5: ${o25.yes}%\n` : '') +
            (btts ? `   BTTS: ${btts.yes}%` : '')
        );
    }).join('\n\n');
    return `┏━━━✧ 🎯 BET TIPS ✧━━━━━━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatNews(data) {
    const items = data.result?.data?.items?.slice(0, 6) || [];
    if (!items.length) return '📰 No news available right now.';
    const rows = items.map((n, i) =>
        `*${i + 1}. ${n.title}*\n${n.summary?.slice(0, 120)}...`
    ).join('\n\n');
    return `┏━━━✧ 📰 FOOTBALL NEWS ✧━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatPlayerSearch(data, query) {
    const players = data.result?.slice(0, 5) || [];
    if (!players.length) return `❌ No players found for *${query}*.`;
    const rows = players.map((p, i) =>
        `*${i + 1}. ${p.name}*\n` +
        `   ⚽ Team: ${p.team || 'N/A'}\n` +
        `   🌍 Nation: ${p.nationality || 'N/A'}\n` +
        `   📌 Position: ${p.position || 'N/A'}\n` +
        `   🎂 DOB: ${p.birthDate || 'N/A'}\n` +
        `   📊 Status: ${p.status || 'N/A'}`
    ).join('\n\n');
    return `┏━━━✧ 🔍 PLAYER SEARCH ✧━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatTeamSearch(data, query) {
    const teams = data.result?.slice(0, 3) || [];
    if (!teams.length) return `❌ No teams found for *${query}*.`;
    const rows = teams.map((t, i) =>
        `*${i + 1}. ${t.name}* (${t.shortName || ''})\n` +
        `   🏟 Stadium: ${t.stadium || 'N/A'} (${t.stadiumCapacity ? t.stadiumCapacity.toLocaleString() : 'N/A'} cap)\n` +
        `   🌍 Location: ${t.location || 'N/A'}\n` +
        `   🏆 League: ${t.league || 'N/A'}\n` +
        `   📅 Founded: ${t.formedYear || 'N/A'}`
    ).join('\n\n');
    return `┏━━━✧ 🔍 TEAM SEARCH ✧━━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatVenueSearch(data, query) {
    const venues = data.result?.slice(0, 3) || [];
    if (!venues.length) return `❌ No venues found for *${query}*.`;
    const rows = venues.map((v, i) =>
        `*${i + 1}. ${v.name}*\n` +
        `   📍 Location: ${v.location || 'N/A'}, ${v.country || 'N/A'}\n` +
        `   🏟 Capacity: ${v.capacity ? v.capacity.toLocaleString() : 'N/A'}\n` +
        `   🏅 Sport: ${v.sport || 'N/A'}\n` +
        `   🕐 Timezone: ${v.timezone || 'N/A'}`
    ).join('\n\n');
    return `┏━━━✧ 🔍 VENUE SEARCH ✧━━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

function formatGameEvents(data, query) {
    const events = data.result?.slice(0, 5) || [];
    if (!events.length) return `❌ No match history found for *${query}*.`;
    const rows = events.map((e, i) => {
        const home = e.teams?.home;
        const away = e.teams?.away;
        return (
            `*${i + 1}. ${e.match}*\n` +
            `   🏆 ${e.league?.name || 'N/A'} — ${e.season || ''}\n` +
            `   📅 ${e.dateTime?.date || 'N/A'} at ${e.dateTime?.time || 'N/A'}\n` +
            `   📍 ${e.venue?.name || 'N/A'}\n` +
            (home && away ? `   ⚽ Score: ${home.score} - ${away.score}\n` : '') +
            `   📊 Status: ${e.status || 'N/A'}`
        );
    }).join('\n\n');
    return `┏━━━✧ 📋 MATCH HISTORY ✧━━━\n\n${rows}\n\n┗━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── LEAGUE MENU ──────────────────────────────────────────────────────────────

function leagueMenu(label, cmd) {
    return (
        `┏━━━✧ ${label} ✧━━━━━━━━━━━\n` +
        `┃ .${cmd} standings   — League table\n` +
        `┃ .${cmd} scorers     — Top goal scorers\n` +
        `┃ .${cmd} upcoming    — Upcoming matches\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━`
    );
}

// ─── SHARED HANDLER ───────────────────────────────────────────────────────────

async function leagueCommand(sock, chatId, message, cmd) {
    try {
        await sock.sendMessage(chatId, { react: { text: '⚽', key: message.key } });

        const rawText = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || '';
        const sub = (rawText.trim().split(/\s+/)[1] || '').toLowerCase();
        const { slug, label } = LEAGUES[cmd];

        if (!sub || !['standings', 'scorers', 'upcoming'].includes(sub)) {
            return sock.sendMessage(chatId, { text: leagueMenu(label, cmd) }, { quoted: createFakeContact(message) });
        }

        const pathMap = { standings: 'standings', scorers: 'scorers', upcoming: 'upcomingmatches' };
        const data = await get(`/${slug}/${pathMap[sub]}`);

        if (!data.status) {
            const msg = data.error || data.message || 'Data not available right now.';
            return sock.sendMessage(chatId, {
                text: `⚠️ ${label} ${sub}: ${msg}`
            }, { quoted: createFakeContact(message) });
        }

        let text;
        if (sub === 'standings') text = formatStandings(data);
        else if (sub === 'scorers') text = formatScorers(data);
        else text = formatUpcoming(data);

        return sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });

    } catch (err) {
        console.error(`[${cmd}] error:`, err.message);
        return sock.sendMessage(chatId, {
            text: `❌ Failed to fetch ${cmd.toUpperCase()} data.\n${err.message}`
        }, { quoted: createFakeContact(message) });
    }
}

// ─── INDIVIDUAL COMMANDS ──────────────────────────────────────────────────────

async function livescoreCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🔴', key: message.key } });
        const data = await get('/livescore');
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatLivescore(data) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[livescore] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Could not fetch live scores.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function betTipsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🎯', key: message.key } });
        const data = await get('/bet');
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatBetTips(data) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[bettips] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Could not fetch bet tips.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function footballNewsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '📰', key: message.key } });
        const data = await get('/football/news');
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatNews(data) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[fnews] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Could not fetch football news.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function playerSearchCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = rawText.trim().split(/\s+/).slice(1).join(' ');
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '❌ Provide a player name.\nExample: *.player Messi*'
            }, { quoted: createFakeContact(message) });
        }
        const data = await get(`/sport/playersearch?q=${encodeURIComponent(query)}`);
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatPlayerSearch(data, query) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[player] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Player search failed.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function teamSearchCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = rawText.trim().split(/\s+/).slice(1).join(' ');
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '❌ Provide a team name.\nExample: *.team Arsenal*'
            }, { quoted: createFakeContact(message) });
        }
        const data = await get(`/sport/teamsearch?q=${encodeURIComponent(query)}`);
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatTeamSearch(data, query) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[team] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Team search failed.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function venueSearchCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🏟', key: message.key } });
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = rawText.trim().split(/\s+/).slice(1).join(' ');
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '❌ Provide a venue name.\nExample: *.venue Emirates*'
            }, { quoted: createFakeContact(message) });
        }
        const data = await get(`/sport/venuesearch?q=${encodeURIComponent(query)}`);
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatVenueSearch(data, query) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[venue] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Venue search failed.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

async function gameEventsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '📋', key: message.key } });
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = rawText.trim().split(/\s+/).slice(1).join(' ');
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '❌ Provide a match query.\nExample: *.gameevents Arsenal vs Chelsea*'
            }, { quoted: createFakeContact(message) });
        }
        const data = await get(`/sport/gameevents?q=${encodeURIComponent(query)}`);
        if (!data.status) throw new Error('API error');
        return sock.sendMessage(chatId, { text: formatGameEvents(data, query) }, { quoted: createFakeContact(message) });
    } catch (err) {
        console.error('[gameevents] error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Match history lookup failed.\n${err.message}` }, { quoted: createFakeContact(message) });
    }
}

// ─── SPORTS HELP MENU ─────────────────────────────────────────────────────────

async function sportsHelpCommand(sock, chatId, message) {
    const text =
        `┏━━━✧ ⚽ SPORTS COMMANDS ✧━━━━\n` +
        `┃\n` +
        `┃ 🔴 *Live & News*\n` +
        `┃  .livescore      — Live scores\n` +
        `┃  .bettips        — Bet predictions\n` +
        `┃  .fnews          — Football news\n` +
        `┃\n` +
        `┃ 🔍 *Search*\n` +
        `┃  .player [name]  — Player info\n` +
        `┃  .team [name]    — Team info\n` +
        `┃  .venue [name]   — Stadium info\n` +
        `┃  .gameevents [query]  — Match history\n` +
        `┃\n` +
        `┃ 🏆 *Leagues* (standings / scorers / upcoming)\n` +
        `┃  .epl        — English Premier League\n` +
        `┃  .laliga     — La Liga\n` +
        `┃  .ucl        — Champions League\n` +
        `┃  .bundesliga — Bundesliga\n` +
        `┃  .seriea     — Serie A\n` +
        `┃  .euros      — Euros\n` +
        `┃  .fifa       — FIFA\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━`;
    return sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
}

module.exports = {
    livescoreCommand,
    betTipsCommand,
    footballNewsCommand,
    playerSearchCommand,
    teamSearchCommand,
    venueSearchCommand,
    gameEventsCommand,
    sportsHelpCommand,
    leagueCommand,
};
