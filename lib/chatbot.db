// ./lib/chatbotDB.js

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const chalk = require('chalk');

// Purple style
const purple = chalk.hex('#9b59ff');

// Database path
const dbPath = path.join(__dirname, '..', 'Database', 'chatbot.db');

// Create Database directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'Database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(purple('[∆RY∆N-TECH] Database directory created'));
}

// Initialize database
const dbe = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(chalk.red('❌ Database Error:'), err);
    } else {
        console.log(purple('[∆RY∆N-TECH] Connected to Chatbot Database.'));
        initializeDatabase();
    }
});

function initializeDatabase() {
    dbe.serialize(() => {

        dbe.run(`
            CREATE TABLE IF NOT EXISTS user_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error(chalk.red('❌ Failed to create user_messages table:'), err.message);
            } else {
                console.log(purple('[∆RY∆N-TECH] user_messages table ready'));
            }
        });

        dbe.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `, (err) => {
            if (err) {
                console.error(chalk.red('❌ Failed to create settings table:'), err.message);
            } else {
                console.log(purple('[∆RY∆N-TECH] settings table ready'));
            }
        });

    });
}

// Store user message
function storeUserMessage(userId, message) {
    const query = `INSERT INTO user_messages (userId, message) VALUES (?, ?)`;
    dbe.run(query, [userId, message], (err) => {
        if (err) {
            console.error(chalk.red('❌ Error storing message:'), err);
        }
    });
}

// Get user messages
function getUserMessages(userId, limit = 25) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT message 
            FROM user_messages 
            WHERE userId = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        dbe.all(query, [userId, limit], (err, rows) => {
            if (err) {
                console.error(chalk.red('❌ Error retrieving messages:'), err);
                reject(err);
            } else {
                const messages = rows.map(row => row.message).reverse();
                resolve(messages);
            }
        });
    });
}

// Cleanup old messages
function cleanupChatbotMessages(days = 7) {
    const query = `
        DELETE FROM user_messages 
        WHERE timestamp < datetime('now', ?)
    `;

    dbe.run(query, [`-${days} days`], (err) => {
        if (err) {
            if (err.message.includes('no such table')) {
                console.log(
                    chalk.yellow('[BOT] user_messages table not found yet, skipping cleanup')
                );
            } else {
                console.error(chalk.red('❌ Error cleaning up old messages:'), err.message);
            }
        } else {
            console.log(
                purple(`[∆RY∆N-TECH] Cleaned messages older than ${days} days`)
            );
        }
    });
}

// Get setting
function getSetting(key) {
    return new Promise((resolve, reject) => {
        const query = `SELECT value FROM settings WHERE key = ?`;
        dbe.get(query, [key], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.value : null);
            }
        });
    });
}

// Set setting
function setSetting(key, value) {
    const query = `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`;
    dbe.run(query, [key, value], (err) => {
        if (err) {
            console.error(chalk.red('❌ Error saving setting:'), err);
        } else {
            console.log(
                purple(`[∆RY∆N-TECH] Setting saved → ${key}`)
            );
        }
    });
}

// Auto-cleanup every 24 hours
setInterval(() => {
    cleanupChatbotMessages(7);
}, 24 * 60 * 60 * 1000);

// Initial cleanup
cleanupChatbotMessages(7);

module.exports = {
    storeUserMessage,
    getUserMessages,
    cleanupChatbotMessages,
    getSetting,
    setSetting,
    dbe
};
