const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

let progressMsg = null;

async function updateProgress(sock, chatId, message, text) {
    try {
        if (progressMsg) {
            // Edit existing message
            await sock.sendMessage(chatId, { 
                text: text,
                edit: progressMsg.key 
            });
        } else {
            // Send new message and store reference
            const sent = await sock.sendMessage(chatId, { text: text }, { quoted: message });
            progressMsg = sent;
        }
    } catch (e) {
        console.log('Progress update failed:', e);
    }
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit(sock, chatId, message) {
    await updateProgress(sock, chatId, message, '📦 Git: Fetching repository...');
    
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await updateProgress(sock, chatId, message, `📦 Current: ${oldRev.substring(0, 7)}`);
    
    await run('git fetch --all --prune');
    await updateProgress(sock, chatId, message, '📦 Checking for updates...');
    
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    
    if (alreadyUpToDate) {
        await updateProgress(sock, chatId, message, `✅ Already up to date: ${newRev.substring(0, 7)}`);
        return { oldRev, newRev, alreadyUpToDate, commits: '', files: '' };
    }
    
    await updateProgress(sock, chatId, message, `📦 New version: ${newRev.substring(0, 7)}`);
    
    const commits = await run(`git log --pretty=format:"%h %s" ${oldRev}..${newRev}`).catch(() => '');
    const files = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    const fileCount = files.split('\n').filter(f => f.trim()).length;
    
    await updateProgress(sock, chatId, message, `📦 Updating ${fileCount} files...`);
    
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

// MODIFIED: Added token support for private repos
function downloadFile(url, dest, sock, chatId, message, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);

            updateProgress(sock, chatId, message, '⬇️ Downloading update...');

            // Read token from settings or environment
            const token = settings.updateZipToken || process.env.UPDATE_ZIP_TOKEN;

            const headers = {
                'User-Agent': 'June-xbot-Updater/1.0',
                'Accept': '*/*'
            };
            if (token) {
                // GitHub uses 'token' scheme; for other platforms (GitLab, Bitbucket) use 'Bearer'
                headers['Authorization'] = `token ${token}`;
            }

            const useHttps = url.startsWith('https://');
            const client = useHttps ? require('https') : require('http');
            const req = client.get(url, { headers }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    // Recursively follow redirects (token headers will be re-applied in the next call)
                    return downloadFile(nextUrl, dest, sock, chatId, message, visited).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const totalSize = parseInt(res.headers['content-length'], 10);
                let downloadedSize = 0;
                let lastPercent = 0;

                const file = fs.createWriteStream(dest);
                
                res.on('data', chunk => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        if (percent >= lastPercent + 20) {
                            lastPercent = percent;
                            updateProgress(sock, chatId, message, `⬇️ Download: ${percent}%`);
                        }
                    }
                });
                
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    updateProgress(sock, chatId, message, '⬇️ Download complete');
                    resolve();
                });
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir, sock, chatId, message) {
    await updateProgress(sock, chatId, message, '📂 Extracting files...');
    
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath}' -o'${outDir}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    throw new Error("No unzip tool found");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    await updateProgress(sock, chatId, message, '🗜️ Starting ZIP update...');
    
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) {
        throw new Error('No ZIP URL configured');
    }
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath, sock, chatId, message);
    
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    
    await extractZip(zipPath, extractTo, sock, chatId, message);
    await updateProgress(sock, chatId, message, '📋 Copying files...');

    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;
    
    const ignore = ['node_modules', '.git', 'session', 'tmp', 'tmp/', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    
    // Preserve owner settings
    let preservedOwner = null;
    let preservedBotOwner = null;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings && currentSettings.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings && currentSettings.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}
    
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);
    
    if (preservedOwner) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(settingsPath)) {
                let text = fs.readFileSync(settingsPath, 'utf8');
                text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner) {
                    text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
                }
                fs.writeFileSync(settingsPath, text);
            }
        } catch {}
    }
    
    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    
    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    await updateProgress(sock, chatId, message, '♻️ Restarting bot...');
    
    try {
        await run('pm2 restart all');
        return;
    } catch {}
    
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only bot owner can use .update' 
        }, { quoted: message });
        return;
    }
    
    const startTime = Date.now();
    progressMsg = null;
    
    try {
        await updateProgress(sock, chatId, message, '🔄 Starting update...');
        
        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit(sock, chatId, message);
            
            if (alreadyUpToDate) {
                await updateProgress(sock, chatId, message, `✅ Already up to date (${newRev.substring(0, 7)})`);
                progressMsg = null;
                return;
            }
            
            await updateProgress(sock, chatId, message, '📦 Installing dependencies...');
            await run('npm install --no-audit --no-fund');
            
        } else {
            await updateProgress(sock, chatId, message, '⚠️ Using ZIP mode');
            await updateViaZip(sock, chatId, message, zipOverride);
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        try {
            const v = require('../settings').version || 'unknown';
            await updateProgress(sock, chatId, message, 
                `✅ Update complete! (${elapsed}s)\n📦 v${v}\n♻️ Restarting...`);
        } catch {
            await updateProgress(sock, chatId, message, 
                `✅ Update complete! (${elapsed}s)\n♻️ Restarting...`);
        }
        
        await restartProcess(sock, chatId, message);
        
    } catch (err) {
        console.error('Update failed:', err);
        await updateProgress(sock, chatId, message, `❌ Failed: ${err.message.substring(0, 50)}`);
        progressMsg = null;
    }
}

module.exports = updateCommand;
