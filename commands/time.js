const { createFakeContact } = require('../lib/fakeContact');
const { getTimezone } = require('../lib/botConfig');

async function timeCommand(sock, chatId, message) {
    try {
        const TIMEZONE = getTimezone();
        const now = new Date();

        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).formatToParts(now);

        const get = (type) => parts.find(p => p.type === type)?.value || '';

        const dayName = get('weekday');
        const day     = get('day');
        const month   = get('month');
        const year    = get('year');
        const hour12  = get('hour');
        const minute  = get('minute');
        const second  = get('second');
        const ampm    = get('dayPeriod');

        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekDayShort = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(now);
        const dayOfWeek = weekdays.findIndex(d => d.startsWith(weekDayShort)) + 1 || '?';

        const hour24 = String(new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            hour: '2-digit',
            hour12: false
        }).format(now)).padStart(2, '0');

        const text = `
🕐 *REAL-TIME CLOCK* 🕐

📅 *Date:*
🔸 *Day:* ${dayName}
🔸 *Date:* ${day} ${month} ${year}
🔹 *Week Day:* Day ${dayOfWeek} of the week

⏰ *Time:*
🔹 *12-Hour:* ${hour12}:${minute}:${second} ${ampm}
🔸 *24-Hour:* ${hour24}:${minute}:${second}
🔹 *Timezone:* ${TIMEZONE}
`.trim();

        await sock.sendMessage(chatId, { text }, { quoted: createFakeContact(message) });
    } catch (error) {
        console.error('Error in time command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch current time.' }, { quoted: createFakeContact(message) });
    }
}

module.exports = timeCommand;
