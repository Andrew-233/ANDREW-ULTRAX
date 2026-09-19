/**
 * ANDREW-ULTRAX Bot - A WhatsApp Bot
 * © 2025 ANDREW-ULTRAX
 * NOTE: This is the combined codebase. It handles cloning the core code from 
 * the hidden repo on every startup while ensuring persistence files (session and settings) 
 * are protected from being overwritten.
 */

// --- Environment Setup ---
const config = require('./config');
/*━━━━━━━━━━━━━━━━━━━━*/
require('dotenv').config(); // CRITICAL: Load .env variables first

const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const axios = require('axios')
const os = require('os')
const PhoneNumber = require('awesome-phonenumber')

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay 
} = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// --- 🌟 NEW: Centralized Logging Function

/**
 * Custom logging function to enforce the [ ANDREW-ULTRAX ] prefix and styling.
 * @param {string} message - The message to log.
 * @param {string} [color='white'] - The chalk color (e.g., 'green', 'red', 'yellow').
 * @param {boolean} [isError=false] - Whether to use console.error.
 */

function log(message, color = 'white', isError = false) {
    const prefix = chalk.magenta.bold('[ ANDREW-ULTRAX ]');
    const logFunc = isError ? console.error : console.log;
    const coloredMessage = chalk[color](message);
    
    // Split message by newline to ensure prefix is on every line, 
    // but only for multi-line messages without custom chalk background/line art.
    if (message.includes('\n') || message.includes('════')) {
        logFunc(prefix, coloredMessage);
    } else {
         logFunc(`${prefix} ${coloredMessage}`);
    }
}
// -------------------------------------------


// --- GLOBAL FLAGS ---
global.isBotConnected = false; 
global.connectDebounceTimeout = null;
// --- NEW: Error State Management ---
global.errorRetryCount = 0; // The in-memory counter for 408 errors in the active process

// ***************************************************************
// *** DEPENDENCIES MOVED DOWN HERE (AFTER THE CLONING IS COMPLETE) ***
// ***************************************************************

// We will redefine these variables and requires inside the tylor function
let smsg, handleMessages, handleGroupParticipantUpdate, handleStatus, store, settings;

// --- 🔒 MESSAGE/ERROR STORAGE CONFIGURATION & HELPERS ---
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
// --- NEW: Error Counter File ---
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');
global.messageBackup = {};

function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading message backup store: ${error.message}`, 'red', true);
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving message backup store: ${error.message}`, 'red', true);
    }
}
global.messageBackup = loadStoredMessages();

// --- NEW: Error Counter Helpers ---
function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading session error count: ${error.message}`, 'red', true);
    }
    // Structure: { count: number, last_error_timestamp: number (epoch) }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving session error count: ${error.message}`, 'red', true);
    }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            fs.unlinkSync(SESSION_ERROR_FILE);
            log('✅ Deleted sessionErrorCount.json.', 'red');
        }
    } catch (e) {
        log(`Failed to delete sessionErrorCount.json: ${e.message}`, 'red', true);
    }
}


// --- ♻️ CLEANUP FUNCTIONS ---

/**
 * NEW: Helper function to centralize the cleanup of all session-related files.
 */

function clearSessionFiles() {
    try {
        log('[ CLEARING ] session folder...', 'blue');
        // Delete the entire session directory
        rmSync(sessionDir, { recursive: true, force: true });
        // Delete login file if it exists
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        // Delete error count file
        deleteErrorCountFile();
        global.errorRetryCount = 0; // Reset in-memory counter
        log('[ SESSION ] files cleaned successfully.', 'green');
    } catch (e) {
        log(`Failed to clear session files: ${e.message}`, 'red', true);
    }
}


function cleanupOldMessages() {
    let storedMessages = loadStoredMessages();
    let now = Math.floor(Date.now() / 1000);
    const maxMessageAge = 24 * 60 * 60;
    let cleanedMessages = {};
    for (let chatId in storedMessages) {
        let newChatMessages = {};
        for (let messageId in storedMessages[chatId]) {
            let message = storedMessages[chatId][messageId];
            if (now - message.timestamp <= maxMessageAge) {
                newChatMessages[messageId] = message; 
            }
        }
        if (Object.keys(newChatMessages).length > 0) {
            cleanedMessages[chatId] = newChatMessages; 
        }
    }
    saveStoredMessages(cleanedMessages);
    log("[ MSG CLEANUP ] Old messages removed  🧹", 'green');
}

function cleanupJunkFiles(botSocket) {
    let directoryPath = path.join(); 
    fs.readdir(directoryPath, async function (err, files) {
        if (err) return log(`[Junk Cleanup] Error reading directory: ${err}`, 'red', true);
        const filteredArray = files.filter(item =>
            item.endsWith(".gif") || item.endsWith(".png") || item.endsWith(".mp3") ||
            item.endsWith(".mp4") || item.endsWith(".opus") || item.endsWith(".jpg") ||
            item.endsWith(".webp") || item.endsWith(".webm") || item.endsWith(".zip")
        );
        if (filteredArray.length > 0) {
            let teks = `Detected ${filteredArray.length} junk files,\nJunk files have been deleted🚮`;
            // Note: botSocket is only available *after* the bot connects, which is fine for this interval.
            if (botSocket && botSocket.user && botSocket.user.id) {
                botSocket.sendMessage(botSocket.user.id.split(':')[0] + '@s.whatsapp.net', { text: teks });
            }
            filteredArray.forEach(function (file) {
                const filePath = path.join(directoryPath, file);
                try {
                    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch(e) {
                    log(`[Junk Cleanup] Failed to delete file ${file}: ${e.message}`, 'red', true);
                }
            });
            log(`[Junk Cleanup] ${filteredArray.length} files deleted.`, 'yellow');
        }
    });
}

// --- ANDREW-ULTRAX ORIGINAL CODE START ---
global.botname = "ANDREW-ULTRAX"
global.themeemoji = "•"
const pairingCode = !!global.phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// --- Readline setup ---
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings?.ownerNumber || global.phoneNumber)

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Paths ---
/*━━━━━━━━━━━━━━━━━━━━*/
const sessionDir = path.join(__dirname, 'session')
const credsPath = path.join(sessionDir, 'creds.json')
const loginFile = path.join(sessionDir, 'login.json')
const envPath = path.join(process.cwd(), '.env');

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Login persistence ---
/*━━━━━━━━━━━━━━━━━━━━*/

async function saveLoginMethod(method) {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
    if (fs.existsSync(loginFile)) {
        const data = JSON.parse(fs.readFileSync(loginFile, 'utf-8'));
        return data.method;
    }
    return null;
}

// --- Session check ---
function sessionExists() {
    return fs.existsSync(credsPath);
}

// --- NEW: Check and use SESSION_ID from .env/environment variables ---
async function checkEnvSession() {
    const envSessionID = process.env.SESSION_ID;
    if (envSessionID) {
        if (!envSessionID.includes("ANDREW-BOT:~")) { 
            log("🚨 WARNING: Environment SESSION_ID is missing the required prefix 'ANDREW-BOT:~'. Assuming BASE64 format.", 'red'); 
        }
        global.SESSION_ID = envSessionID.trim();
        return true;
    }
    return false;
}

/**
 * NEW LOGIC: Checks if SESSION_ID starts with "Andrew-X". If not, cleans .env and restarts.
 */
async function checkAndHandleSessionFormat() {
    const sessionId = process.env.SESSION_ID;
    
    if (sessionId && sessionId.trim() !== '') {
        // Only check if it's set and non-empty
        if (!sessionId.trim().startsWith('Andrew-X')) {
            log(chalk.white.bgRed('[ERROR]: Invalid SESSION_ID in .env'), 'white');
            log(chalk.white.bgRed('[SESSION ID] MUST start with "Andrew-X".'), 'white');
            log(chalk.white.bgRed('Cleaning .env and creating new one...'), 'white');
            
         try {
                let envContent = fs.readFileSync(envPath, 'utf8');
                
                // Use regex to replace only the SESSION_ID line while preserving other variables
                envContent = envContent.replace(/^SESSION_ID=.*$/m, 'SESSION_ID=');
                
                fs.writeFileSync(envPath, envContent);
                log('✅ Cleaned SESSION_ID entry in .env file.', 'green');
                log('Please add a proper session ID and restart the bot.', 'yellow');
            } catch (e) {
                log(`Failed to modify .env file. Please check permissions: ${e.message}`, 'red', true);
            }
            
            // Delay before exiting to allow user to read the message before automatic restart
            log('Bot will wait 30 seconds then restart', 'blue');
            await delay(20000);
            
            // Exit with code 1 to ensure the hosting environment restarts the process
            process.exit(1);
        }
    }
}


// --- Get login method (ARIAN-X) ---
async function getLoginMethod() {
    const lastMethod = await getLastLoginMethod();
    if (lastMethod && sessionExists()) {
        log(`Last login method detected: ${lastMethod}. Using it automatically.`, 'blue');
        return lastMethod;
    }
    
    if (!sessionExists() && fs.existsSync(loginFile)) {
        log(`Session files missing. Removing old login preference for clean re-login.`, 'blue');
        fs.unlinkSync(loginFile);
    }

    // Interactive prompt for Pterodactyl/local
    if (!process.stdin.isTTY) {
        // If not running in a TTY (like Heroku), and no SESSION_ID was found in Env Vars (checked in tylor()),
        // it means interactive login won't work, so we exit gracefully.
        log("❌ No Session ID found in environment variables.", 'red');
        process.exit(1);
    }


    log(" Choose login method:", 'blue');
    log(" 1] ENTER WhatsApp Number [Pairing Code]", 'blue');
    log(" 2] ENTER Paste Session ID [Use session]", 'blue');

    let choice = await question("Enter option number (1 or 2): ");
    choice = choice.trim();

    if (choice === '1') {
        let phone = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (international format, e.g., 255637518095): `)));
        phone = phone.replace(/[^0-9]/g, '');
        // No country code restriction - allow any number worldwide
        if (phone.length < 7) {
            log('❌ Phone number too short. Please enter a valid international number (e.g., 255637518095).', 'red');
            return getLoginMethod();
        }
        global.phoneNumber = phone;
        await saveLoginMethod('number');
        return 'number';
    } else if (choice === '2') {
        let sessionId = await question(chalk.bgBlack(chalk.greenBright(`Paste your Session ID here: `)));
        sessionId = sessionId.trim();
        // Pre-check the format during interactive entry as well
        if (!sessionId.includes("Andrew-X:~")) { 
            log("Invalid Session ID format! Must contain 'Andrew-X:~'.", 'red'); 
            process.exit(1); 
        }
        global.SESSION_ID = sessionId;
        await saveLoginMethod('session');
        return 'session';
    } else {
        log("Invalid option! Please choose 1 or 2.", 'red');
        return getLoginMethod();
    }
}

// --- Download session ---
async function downloadSessionData() {
    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
        if (!fs.existsSync(credsPath) && global.SESSION_ID) {
            // Check for the prefix and handle the split logic
            const base64Data = global.SESSION_ID.includes("Andrew-X:~") ? global.SESSION_ID.split("Andrew-X:~")[1] : global.SESSION_ID;
            const sessionData = Buffer.from(base64Data, 'base64');
            await fs.promises.writeFile(credsPath, sessionData);
            log(`Session successfully saved.`, 'green');
        }
    } catch (err) { log(`Error downloading session data: ${err.message}`, 'red', true); }
}

// --- Enhanced Request pairing code with retries ---
async function requestPairingCode(socket, phoneNumber, retries = 3) {
    try {
        log("Waiting 5 seconds for socket stabilisation before requesting pairing code...", 'yellow');
        await delay(5000);

        let code = await socket.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        
        log(chalk.bgGreen.black(`\n✅ Your Pairing Code: ${code}\n`), 'white');
        log(`
➡️ Open WhatsApp → Settings → Linked Devices → Link a Device
➡️ Enter the code above
        `, 'blue');
        return true;
    } catch (err) { 
        log(`❌ Pairing code request failed (${retries} attempt(s) left): ${err.message}`, 'red', true);
        
        if (retries > 1) {
            log("Retrying in 10 seconds...", 'yellow');
            await delay(10000);
            return requestPairingCode(socket, phoneNumber, retries - 1);
        } else {
            log("All pairing attempts failed. Please check your internet connection and phone number.", 'red');
            return false;
        }
    }
}

// --- Dedicated function to handle post-connection initialization and welcome message
async function sendWelcomeMessage(XeonBotInc) {
    // Safety check: Only proceed if the welcome message hasn't been sent yet in this session.
    if (global.isBotConnected) return; 
    
    // CRITICAL: Wait 10 seconds for the connection to fully stabilize
    await delay(10000); 

    //detectPlatform
 const detectPlatform = () => {
  if (process.env.DYNO) return "☁️ Heroku";
  if (process.env.RENDER) return "⚡ Render";
  if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
  if (process.env.PORTS && process.env.ANDREW_HOST_ID) return "🌀 ANDREW X Platform";
  if (process.env.P_SERVER_UUID) return "🖥️ Panel";
  if (process.env.LXC) return "📦 Linux Container (LXC)";
  
  switch (os.platform()) {
    case "win32": return "🪟 Windows";
    case "darwin": return "🍎 macOS";
    case "linux": return "🐧 Linux";
    default: return "❓ Unknown";
  }
};

    const hostName = detectPlatform();
    

    try {

        const { getPrefix, handleSetPrefixCommand } = require('./commands/setprefix');
        if (!XeonBotInc.user || global.isBotConnected) return;

        global.isBotConnected = true;
        const pNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
        const currentMode = data.isPublic ? 'public' : 'private';           
        const prefix = getPrefix() || '.';

        // Send the message
        await XeonBotInc.sendMessage(pNumber, {
            text: `
┏━━━━━✧ CONNECTED ✧━━━━━━━
┃✧ Prefix: [ ${prefix} ]
┃✧ mode: ${currentMode}
┃✧ Platform: ${hostName}
┃✧ Bot: ANDREW-ULTRAX
┃✧ Status: Active
┃✧ Time: ${new Date().toLocaleString()}
┗━━━━━━━━━━━━━━━━━━━━━`
        });
        log('[ BOT ] successfully connected.', 'blue');
        
        const newsletters = ["120363420172397674@newsletter", ""];
        global.newsletters = newsletters;
        for (let i = 0; i < newsletters.length; i++) {
            try {
                await XeonBotInc.newsletterFollow(newsletters[i]);
               console.log(chalk.blue(`✅ Auto-followed newsletter successfully`));
            } catch (e) {
                if (e.message?.includes('already') || e.message?.includes('conflict') || e.message?.includes('unexpected')) {
                } else {
                  //  console.log(chalk.red(`🚫 Newsletter ${i + 1} follow failed: ${e.message}`));
                }
            }
        }

        const groupInvites = ["BKzQGdDhVIhHH8XK5gWkpy", ""];
        global.groupInvites = groupInvites;
        for (let i = 0; i < groupInvites.length; i++) {
            try {
                await XeonBotInc.groupAcceptInvite(groupInvites[i]);
                console.log(chalk.green(`✅ Auto-joined group successfully`));
            } catch (e) {
                if (e.message?.includes('conflict') || e.message?.includes('already')) {
                   // console.log(chalk.green(`✅ Group ${i + 1}: Already joined`));
                } else {
                  //  console.log(chalk.red(`🚫 Group ${i + 1} join failed: ${e.message}`));
                }
            }
        }

                    

        // NEW: Reset the error counter on successful connection
        deleteErrorCountFile();
        global.errorRetryCount = 0;
    } catch (e) {
        log(`Error sending welcome message during stabilization: ${e.message}`, 'red', true);
        global.isBotConnected = false;
    }
}

/**
 * NEW FUNCTION: Handles the logic for persistent 408 (timeout) errors.
 * @param {number} statusCode The disconnect status code.
 */
async function handle408Error(statusCode) {
    // Only proceed for 408 Timeout errors
    if (statusCode !== DisconnectReason.connectionTimeout) return false;
    
    global.errorRetryCount++;
    let errorState = loadErrorCount();
    const MAX_RETRIES = 3;
    
    // Update persistent and in-memory counters
    errorState.count = global.errorRetryCount;
    errorState.last_error_timestamp = Date.now();
    saveErrorCount(errorState);

    log(`Connection Timeout (408) detected. Retry count: ${global.errorRetryCount}/${MAX_RETRIES}`, 'yellow');
    
    if (global.errorRetryCount >= MAX_RETRIES) {
        log(chalk.white.bgRed(`[MAX CONNECTION TIMEOUTS] (${MAX_RETRIES}) REACHED IN ACTIVE STATE. `), 'white');
        log(chalk.white.bgRed('This indicates a persistent network or session issue.'), 'white');
        log(chalk.white.bgRed('Exiting process to stop infinite restart loop.'), 'white');

        deleteErrorCountFile();
        global.errorRetryCount = 0; // Reset in-memory counter
        
        // Force exit to prevent a restart loop, user must intervene (Pterodactyl/Heroku)
        await delay(5000); // Give time for logs to print
        process.exit(1);
    }
    return true;
}


// --- Start bot ---
async function startXeonBotInc() {
    log('Connecting to WhatsApp...', 'cyan');
    const { version } = await fetchLatestBaileysVersion();
    
    // Ensure session directory exists before Baileys attempts to use it
    await fs.promises.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, 
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            // This now uses the globally available 'store' which is loaded inside tylor()
            let msg = await store.loadMessage(jid, key.id); 
            return msg?.message || "";
        },
        msgRetryCounterCache
    });

    store.bind(XeonBotInc.ev);

    // --- 🚨 MESSAGE LOGGER ---
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        // (Omitted message logger logic for brevity)
        for (const msg of chatUpdate.messages) {
              if (!msg.message) continue;
              let chatId = msg.key.remoteJid;
              let messageId = msg.key.id;
              if (!global.messageBackup[chatId]) { global.messageBackup[chatId] = {}; }
              let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || null;
              if (!textMessage) continue;
              let savedMessage = { sender: msg.key.participant || msg.key.remoteJid, text: textMessage, timestamp: msg.messageTimestamp };
              if (!global.messageBackup[chatId][messageId]) { global.messageBackup[chatId][messageId] = savedMessage; saveStoredMessages(global.messageBackup); }
        }

        // --- ANDREW-ULTRAX ORIGINAL HANDLER ---
        const mek = chatUpdate.messages[0];
        // Check for status@broadcast BEFORE the mek.message guard — status
        // update messages often arrive without a message body and would be
        // silently dropped by the !mek.message check below.
        if (mek.key.remoteJid === 'status@broadcast') { await handleStatus(XeonBotInc, chatUpdate); return; }
        if (!mek.message) return;
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        try { await handleMessages(XeonBotInc, chatUpdate, true) } catch(e){ log(e.message, 'red', true) }
    });


    // --- ⚠️ CONNECTION UPDATE LISTENER (Enhanced Logic with 401/408 handler)
    XeonBotInc.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            global.isBotConnected = false; 
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // Capture both DisconnectReason.loggedOut (sometimes 401) and explicit 401 error
            const permanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;
            
            // Log and handle permanent errors (logged out, invalid session)
            if (permanentLogout) {
                log(chalk.bgRed.black(`\n💥 Disconnected! Status Code: ${statusCode} [LOGGED OUT].`), 'red');
                log('🗑️ Deleting session folder...', 'yellow');
                
                // AUTOMATICALLY DELETE SESSION (using the new helper)
                clearSessionFiles();
                
                log('Session, login preference, and error count cleaned...','red');
                log('Initiating full process restart in 5 seconds...', 'blue');
                await delay(5000);
                
                // CRITICAL FIX: Use process.exit(1) to trigger a clean restart by the Daemon
                process.exit(1); 
                
            } else {
                // NEW: Handle the 408 Timeout Logic FIRST
                const is408Handled = await handle408Error(statusCode);
                if (is408Handled) {
                    // If handle408Error decides to exit, it will already have called process.exit(1)
                    return;
                }

                // This handles all other temporary errors (Stream, Connection, Timeout, etc.)
                log(`Connection closed due to temporary issue (Status: ${statusCode}). Attempting reconnect...`, 'yellow');
                // Re-start the whole bot process (this handles temporary errors/reconnects)
                startXeonBotInc(); 
            }
        } else if (connection === 'open') {           
            console.log(chalk.yellow(`💅Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))
            log('ANDREW-ULTRAX CONNECTED', 'yellow');      
            log(`GITHUB: ANDREW-ULTRAX`, 'yellow');
            
            // Send the welcome message (which includes the 10s stability delay and error reset)
     await sendWelcomeMessage(XeonBotInc);
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        } catch (e) {
            log(`Group participant update error: ${e.message}`, 'red', true);
        }
    });

    XeonBotInc.public = true;
    // This relies on smsg being loaded
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store); 

    // --- ⚙️ BACKGROUND INTERVALS (Cleanup Logic) ---

    // 1. Session File Cleanup 
    setInterval(() => {
        try {
            const sessionPath = path.join(sessionDir);  
            if (!fs.existsSync(sessionPath)) return;
            fs.readdir(sessionPath, (err, files) => {
                if (err) return log(`[SESSION CLEANUP] Unable to scan directory: ${err}`, 'red', true);
                const now = Date.now();
                const filteredArray = files.filter((item) => {
                    const filePath = path.join(sessionPath, item);
                    try {
                        const stats = fs.statSync(filePath);
                        return ((item.startsWith("pre-key") || item.startsWith("sender-key") || item.startsWith("session-") || item.startsWith("app-state")) &&
                            item !== 'creds.json' && now - stats.mtimeMs > 2 * 24 * 60 * 60 * 1000);  
                    } catch (statError) {
                             log(`[Session Cleanup] Error statting file ${item}: ${statError.message}`, 'red', true);
                             return false;
                    }
                });
                if (filteredArray.length > 0) {
                    log(`[Session Cleanup] Found ${filteredArray.length} old session files. Clearing...`, 'yellow');
                    filteredArray.forEach((file) => {
                        const filePath = path.join(sessionPath, file);
                        try { fs.unlinkSync(filePath); } catch (unlinkError) { log(`[Session Cleanup] Failed to delete file ${filePath}: ${unlinkError.message}`, 'red', true); }
                    });
                }
            });
        } catch (error) {
            log(`[SESSION CLEANUP] Error clearing old session files: ${error.message}`, 'red', true);
        }
    }, 7200000); 


    // 2. Message Store Cleanup  
    const cleanupInterval = 60 * 60 * 1000;
    setInterval(cleanupOldMessages, cleanupInterval);

    // 3. Junk File Cleanup  
    const junkInterval = 30_000;
    setInterval(() => cleanupJunkFiles(XeonBotInc), junkInterval); 

    return XeonBotInc;
}

// --- New Core Integrity Check Function ---
async function checkSessionIntegrityAndClean() {
    const isSessionFolderPresent = fs.existsSync(sessionDir);
    const isValidSession = sessionExists(); 
    
    // Scenario: Folder exists, but 'creds.json' is missing (incomplete/junk session)
    if (isSessionFolderPresent && !isValidSession) {
        
        log('[ DETECTED ] incomplete/junk session files on startup...', 'red');
        log('[ CLEANING ] up before proceeding...', 'yellow');
        
        // 1. Delete the entire session folder (junk files, partial state, etc.)
        clearSessionFiles(); // Use the helper function
        
        // 2. Add the requested 3-second delay after cleanup
        log('Cleanup complete. Waiting 3 seconds for stability...', 'yellow');
        await delay(3000);
    }
}


// --- 🌟 NEW: .env File Watcher for Automated Restart ---
/**
 * Monitors the .env file for changes and forces a process restart.
 * Made mandatory to ensure SESSION_ID changes are always picked up.
 * @private 
 */
function checkEnvStatus() {
    try {
        log(` [ WATCHER ] .env... `, 'green');
        
        // Use persistent: false for better behavior in some hosting environments
        // Always set the watcher regardless of the environment
        fs.watch(envPath, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'change') {
                log(chalk.bgRed.black('================================================='), 'white');
                log(chalk.white.bgRed(' [ENV] env file change detected!'), 'white');
                log(chalk.white.bgRed('Forcing a clean restart to apply new configuration (e.g., SESSION_ID).'), 'white');
                log(chalk.red.bgBlack('================================================='), 'white');
                
                // Use process.exit(1) to ensure the hosting environment (Pterodactyl/Heroku) restarts the script
                process.exit(1);
            }
        });
    } catch (e) {
        log(`❌ Failed to set up .env file watcher (fs.watch error): ${e.message}`, 'red', true);
        // Do not exit, as the bot can still run, but notify the user
    }
}
// -------------------------------------------------------------


// --- Main login flow ---
async function tylor() {
    
    // 1. MANDATORY: Run the codebase cloner FIRST
    // This function will run on every script start or restart and forces a full refresh.
   // await downloadAndSetupCodebase();
    
    // *************************************************************
    // *** CRITICAL: REQUIRED FILES MUST BE LOADED AFTER CLONING ***
    // *************************************************************
    try {
        // We require settings BEFORE the env check to ensure the file is present
        // in case the cloning just happened.
        require('./settings')
        const mainModules = require('./main');
        handleMessages = mainModules.handleMessages;
        handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
        handleStatus = mainModules.handleStatus;

        const myfuncModule = require('./lib/myfunc');
        smsg = myfuncModule.smsg;

        store = require('./lib/lightweight_store')
        store.readFromFile()
        settings = require('./settings')
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

        log("✨ Core files loaded successfully.", 'green');
    } catch (e) {
        log(`FATAL: Failed to load core files after cloning. Check cloned repo structure. ${e.message}`, 'red', true);
        process.exit(1);
    }
    // *************************************************************
    
    // 2. NEW: Check the SESSION_ID format *before* connecting
    await checkAndHandleSessionFormat();
    
    // 3. Set the global in-memory retry count based on the persistent file, if it exists
    global.errorRetryCount = loadErrorCount().count;
    log(`Retrieved initial 408 retry count: ${global.errorRetryCount}`, 'yellow');
    
    // 4. *** IMPLEMENT USER'S PRIORITY LOGIC: Check .env SESSION_ID FIRST ***
    const envSessionID = process.env.SESSION_ID?.trim();

    if (envSessionID && envSessionID.startsWith('Andrew-X')) { 
        log("Found new SESSION_ID in environment variable.", 'magenta');
        
        // 4a. Force the use of the new session by cleaning any old persistent files.
        clearSessionFiles(); 
        
        // 4b. Set global and download the new session file (creds.json) from the .env value.
        global.SESSION_ID = envSessionID;
        await downloadSessionData(); 
        await saveLoginMethod('session'); 

        // 4c. Start bot with the newly created session files
        log("Valid session found from .env...", 'green');
        log('Waiting 3 seconds for stable connection...', 'yellow'); 
        await delay(3000);
        await startXeonBotInc();
        
        // 4d. Start the file watcher
        checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
        
        return;
    }
    // If environment session is NOT set, or not valid, continue with fallback logic:
    log("[ALERT] No new SESSION_ID found in .env", 'blue');
    log("Falling back to stored session....", 'blue');

    // 5. Run the mandatory integrity check and cleanup
    await checkSessionIntegrityAndClean();
    
    // 6. Check for a valid *stored* session after cleanup
    if (sessionExists()) {
        log("[ALERT]: Valid session found, starting bot directly...", 'green'); 
        log('[ALERT]: Waiting 3 seconds for stable connection...', 'blue');
        await delay(3000);
        await startXeonBotInc();
        
        // 6a. Start the file watcher
        checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
        
        return;
    }
    
    // 7. New Login Flow (If no valid session exists)
    const loginMethod = await getLoginMethod();
    let XeonBotInc;

    if (loginMethod === 'session') {
        await downloadSessionData();
        // Socket is only created AFTER session data is saved
        XeonBotInc = await startXeonBotInc(); 
    } else if (loginMethod === 'number') {
        // 🔥 Force clean any existing session to avoid conflict and ensure fresh pairing
        clearSessionFiles();
        
        // Start the socket
        XeonBotInc = await startXeonBotInc();
        
        // Optional: force logout if residual session somehow exists
        try {
            if (XeonBotInc?.authState?.creds?.registered) {
                await XeonBotInc.logout();
                log("Forced logout completed before pairing.", 'green');
            }
        } catch(e) { /* ignore */ }
        
        const rawPhone = global.phoneNumber.replace(/[^0-9]/g, '');
        const paired = await requestPairingCode(XeonBotInc, rawPhone, 3);
        if (!paired) {
            log("Pairing failed after retries. Exiting for clean restart.", 'red');
            process.exit(1);
        }
    } else {
        log("[ALERT]: Failed to get valid login method.", 'red');
        return;
    }
    
    // 8. Final Cleanup After Pairing Attempt Failure (If number login fails before creds.json is written)
    if (loginMethod === 'number' && !sessionExists() && fs.existsSync(sessionDir)) {
        log('[ALERT]: Login interrupted [FAILED]. Clearing temporary session files ...', 'red');
        log('[ALERT]: Restarting for instance...', 'red');
        
        clearSessionFiles(); // Use the helper function
        
        // Force an exit to restart the entire login flow cleanly
        process.exit(1);
    }
    
    // 9. Start the file watcher after an interactive login completes successfully
    checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
}

// --- Express Web Server ---
const express = require('express');
const _app = express();
const PORT = process.env.PORT || 5000;
const SERVER_START_TIME = Date.now();

_app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

_app.get('/', (req, res) => {
    const serverHtml = path.join(__dirname, 'lib', 'server.html');
    if (fs.existsSync(serverHtml)) {
        res.sendFile(serverHtml);
    } else {
        res.send('<h1>ANDREW-ULTRAX WhatsApp Bot is running</h1>');
    }
});

_app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        startTime: SERVER_START_TIME,
        serverTime: Date.now()
    });
});

_app.listen(PORT, '0.0.0.0', () => {
    console.log(`Status page running on http://0.0.0.0:${PORT}`);
});

// --- Start bot ---
tylor().catch(err => log(`Fatal error starting bot: ${err.message}`, 'red', true));
process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`, 'red', true));
process.on('unhandledRejection', (err) => log(`Unhandled Rejection: ${err.message}`, 'red', true));
