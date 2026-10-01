// deployManager.js is not part of this repository. A top-level require of a missing
// module used to crash the process (MODULE_NOT_FOUND) the moment either command was loaded.
// Load it defensively so the rest of the bot survives, and report the feature as unavailable.
let deployManager = null;
try { deployManager = require('../deployManager'); } catch (_) { deployManager = null; }
const UNAVAILABLE = '\u26a0\ufe0f Deployment manager is not installed on this bot (deployManager.js is missing).';

async function listConnectedCommand(sock, chatId, senderId, message, prefix) {
    if (!deployManager) return await sock.sendMessage(chatId, { text: UNAVAILABLE });
    try {
        const allDeployments = deployManager.listAllDeployments();
        
        if (allDeployments.length === 0) {
            await sock.sendMessage(chatId, {
                text: '📭 No active bot deployments'
            }, { quoted: message });
            return;
        }

        let list = `🚀 Active Deployments (${allDeployments.length})\n\n`;
        allDeployments.forEach((deploy, index) => {
            list += `${index + 1}. ${deploy.isActive ? '🟢' : '🔴'} ${deploy.userJid.split('@')[0]}***\n`;
            list += `   ID: ${deploy.deploymentId}\n\n`;
        });

        await sock.sendMessage(chatId, {
            text: list
        }, { quoted: message });

    } catch (error) {
        console.error('Listconnected error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error fetching deployments'
        }, { quoted: message });
    }
}

module.exports = listConnectedCommand;
