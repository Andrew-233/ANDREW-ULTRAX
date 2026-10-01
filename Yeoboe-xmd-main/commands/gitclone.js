const axios = require('axios');

const { createFakeContact } = require('../lib/fakeContact');
async function gitcloneCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: 'Provide a GitHub repository URL!\nExample: .gitclone https://github.com/username/repo'
        }, { quoted: createFakeContact(message) });

        const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com[\/:]([^\/\n\r]+)\/([^\/\n\r#?]+)(?:[\/]?|[\/]tree[\/]([^\/\n\r]+)?)?/i;
        const match = query.match(githubRegex);
        
        if (!match) return await sock.sendMessage(chatId, {
            text: 'Invalid GitHub URL!\n\nSupported formats:\n• https://github.com/username/repo\n• https://github.com/username/repo/tree/branch\n• github.com/username/repo\n• git@github.com:username/repo.git'
        }, { quoted: createFakeContact(message) });

        let [, user, repo, branch] = match;
        if (!user || !repo) return await sock.sendMessage(chatId, {
            text: 'Could not extract repository information. Please use format: https://github.com/username/repo'
        }, { quoted: createFakeContact(message) });

        repo = repo.replace(/.git$/, '').replace(/[^a-zA-Z0-9\-_]/g, '');
        branch = branch || 'main';

        try {
            await axios.head(`https://api.github.com/repos/${user}/${repo}/branches/${branch}`);
        } catch {
            try {
                await axios.head(`https://api.github.com/repos/${user}/${repo}/branches/master`);
                branch = 'master';
            } catch {
                return await sock.sendMessage(chatId, {
                    text: 'Repository or branch not found! Please check the URL.'
                }, { quoted: createFakeContact(message) });
            }
        }

        const zipUrl = `https://github.com/${user}/${repo}/archive/refs/heads/${branch}.zip`;
        const apiUrl = `https://api.github.com/repos/${user}/${repo}`;
        const repoInfo = await axios.get(apiUrl);

        const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const filename = `${repo}-${branch}-${timestamp}.zip`;

        const head = await axios.head(zipUrl);
        const fileSize = head.headers['content-length'];
        let sizeText = '';
        if (fileSize) {
            const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
            sizeText = ` (${sizeMB} MB)`;
        }

        await sock.sendMessage(chatId, {
            document: { url: zipUrl },
            fileName: filename,
            mimetype: 'application/zip'
        }, { quoted: createFakeContact(message) });

    } catch (error) {
        console.error("Gitclone command error:", error);
        let errorMessage = `Error: ${error.message}`;
        
        if (error.response?.status === 404) {
            errorMessage = "Repository not found! Check the URL and make sure it's public.";
        } else if (error.response?.status === 403) {
            errorMessage = "GitHub API rate limit exceeded. Try again later or add authentication.";
        } else if (error.response?.status === 500) {
            errorMessage = "GitHub server error. Try again later.";
        } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            errorMessage = "Network error. Check your internet connection.";
        }

        return await sock.sendMessage(chatId, { text: errorMessage }, { quoted: createFakeContact(message) });
    }
}

module.exports = gitcloneCommand;
