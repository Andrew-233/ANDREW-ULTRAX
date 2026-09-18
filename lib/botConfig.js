// botConfig.js - Configuration management module
const { getOwnerName, handleSetOwnerCommand } = require('../commands/setowner');

const fs = require('fs');
const path = require('path');
const settings = require('../settings');

// Path to config file in data directory
const configPath = path.join(__dirname, '..', 'data', 'config.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// Default configuration
let config = {
    botName: settings.botName || 'JUNE-X',
    ownerName:'',
    ownerNumber: settings.ownerNumber || '',
    menuImage: '',
    antideletePrivate: false,
    autoFont: 'off',
    timezone: settings.timezone || 'Africa/Nairobi'
};

// Load existing config if available
try {
    if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...savedConfig };
    }
} catch (error) {
    console.error('Failed to load config:', error.message);
}

// Save config to file
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error.message);
    }
}

// Get bot name
function getBotName() {
    return config.botName;
}

// Get menu image
function getMenuImage() {
    return config.menuImage;
}

// Set menu image
function setMenuImage(imagePath) {
    config.menuImage = imagePath;
    saveConfig();
}

// Get full config
function getConfig() {
    return { ...config };
}

// Update config with partial data
function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    saveConfig();
}

// Get timezone
function getTimezone() {
    return config.timezone || 'Africa/Nairobi';
}

// Set timezone
function setTimezone(tz) {
    config.timezone = tz;
    saveConfig();
}

// Get owner number
function getOwnerNumber() {
    return config.ownerNumber || settings.ownerNumber || '';
}

// Set owner number
function setOwnerNumber(number) {
    config.ownerNumber = number;
    saveConfig();
}

module.exports = {
    getBotName,
    getMenuImage,
    setMenuImage,
    getConfig,
    updateConfig,
    getTimezone,
    setTimezone,
    getOwnerNumber,
    setOwnerNumber
};
