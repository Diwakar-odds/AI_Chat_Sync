import * as vscode from 'vscode';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { LocalStorageWatcher } from './watcher';
import { GitHubGistProvider } from './gistProvider';
import { CustomServerProvider } from './customServerProvider';
import { IStorageProvider } from './storage';
import { detectIde, DetectionResult } from './IdeDetector';
import { IIdeAdapter } from './adapters/IdeAdapter';

let statusBarItem: vscode.StatusBarItem;
let autoSyncEnabled = true;
let watcher: LocalStorageWatcher;
let storageProvider: IStorageProvider;
let ideAdapter: IIdeAdapter;
let workspaceId: string;
let isSyncing = false;

function updateStorageProvider() {
    const config = vscode.workspace.getConfiguration('contextgap');
    const method = config.get<string>('storageMethod');
    if (method === 'custom_server') {
        storageProvider = new CustomServerProvider();
    } else {
        storageProvider = new GitHubGistProvider();
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('ContextGap is now active!');
    updateStorageProvider();

    // === IDE Auto-Detection ===
    const detection: DetectionResult = detectIde();
    ideAdapter = detection.adapter;
    console.log(`ContextGap: Detected IDE → ${ideAdapter.ideName} (${detection.confidence} confidence: ${detection.reason})`);
    vscode.window.showInformationMessage(`ContextGap: Running in ${ideAdapter.ideName} mode ✅`);

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('contextgap.storageMethod') || e.affectsConfiguration('contextgap.customServerUrl')) {
            updateStorageProvider();
        }
    });

    const workspaceFolders = vscode.workspace.workspaceFolders;
    // Use the workspace NAME for cross-device compatibility
    const workspaceName = workspaceFolders ? workspaceFolders[0].name : 'no-workspace';
    workspaceId = crypto.createHash('md5').update(workspaceName).digest('hex');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'contextgap.syncNow';
    updateStatusBar();
    statusBarItem.show();

    watcher = new LocalStorageWatcher(context, ideAdapter, async () => {
        if (autoSyncEnabled && !isSyncing) {
            await pushState();
        }
    });
    await watcher.startWatching();

    let pushCmd = vscode.commands.registerCommand('contextgap.push', async () => {
        await pushState();
    });

    let pullCmd = vscode.commands.registerCommand('contextgap.pull', async () => {
        await pullState();
    });

    let syncNowCmd = vscode.commands.registerCommand('contextgap.syncNow', async () => {
        vscode.window.showInformationMessage('ContextGap: Syncing manually...');
        await pushState();
    });

    let toggleAutoSyncCmd = vscode.commands.registerCommand('contextgap.toggleAutoSync', () => {
        autoSyncEnabled = !autoSyncEnabled;
        updateStatusBar();
        vscode.window.showInformationMessage(`ContextGap Auto-Sync is now ${autoSyncEnabled ? 'ON' : 'OFF'}`);
    });

    context.subscriptions.push(pushCmd, pullCmd, syncNowCmd, toggleAutoSyncCmd, statusBarItem);

    // Auto-pull on startup
    await pullState();
}

async function pushState() {
    const dbPath = watcher.getDbPath();
    if (!dbPath || !fs.existsSync(dbPath)) {
        // Try reading via adapter instead
        try {
            isSyncing = true;
            statusBarItem.text = `$(sync~spin) ContextGap: Pushing...`;
            const sessions = await ideAdapter.readChats();
            if (sessions) {
                const payload = {
                    sessions,
                    ideName: ideAdapter.ideName,
                    timestamp: Date.now()
                };
                await storageProvider.push(workspaceId, payload);
            }
            updateStatusBar();
        } catch (e) {
            vscode.window.showErrorMessage(`ContextGap: Failed to push state. Check your GitHub token.`);
            updateStatusBar();
        } finally {
            isSyncing = false;
        }
        return;
    }

    try {
        isSyncing = true;
        statusBarItem.text = `$(sync~spin) ContextGap [${ideAdapter.ideName}]: Pushing...`;
        const fileData = fs.readFileSync(dbPath).toString('base64');
        await storageProvider.push(workspaceId, {
            fileData,
            ideName: ideAdapter.ideName,
            timestamp: Date.now()
        });
        updateStatusBar();
    } catch (e) {
        vscode.window.showErrorMessage(`ContextGap: Failed to push state. Check your GitHub token.`);
        updateStatusBar();
    } finally {
        isSyncing = false;
    }
}

async function pullState() {
    const dbPath = watcher.getDbPath();
    try {
        isSyncing = true;
        statusBarItem.text = `$(sync~spin) ContextGap [${ideAdapter.ideName}]: Pulling...`;
        const payload = await storageProvider.pull(workspaceId);

        if (payload && payload.sessions) {
            // Structured chat sessions (from adapter-based push)
            await ideAdapter.writeChats(payload.sessions);
            vscode.window.showInformationMessage(`ContextGap: AI Context Restored from ${payload.ideName || 'another device'}! ✅`);
        } else if (payload && payload.fileData && dbPath) {
            // Legacy binary file sync
            const localStat = fs.existsSync(dbPath) ? fs.statSync(dbPath).mtimeMs : 0;
            if (payload.timestamp > localStat) {
                fs.writeFileSync(dbPath, Buffer.from(payload.fileData, 'base64'));
                vscode.window.showInformationMessage('ContextGap: AI Context Restored!');
            }
        }
        updateStatusBar();
    } catch (e) {
        // Silently fail on pull (may just be first-time use)
        updateStatusBar();
    } finally {
        isSyncing = false;
    }
}

function updateStatusBar() {
    if (autoSyncEnabled) {
        statusBarItem.text = `$(sync) ContextGap: Auto`;
        statusBarItem.tooltip = `Auto-Sync ON | IDE: ${ideAdapter?.ideName || 'detecting...'}. Click to sync manually.`;
    } else {
        statusBarItem.text = `$(cloud) ContextGap: Manual`;
        statusBarItem.tooltip = `Auto-Sync OFF | IDE: ${ideAdapter?.ideName || 'detecting...'}. Click to sync manually.`;
    }
}

export function deactivate() {
    if (watcher) watcher.stopWatching();
}
