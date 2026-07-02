import * as vscode from 'vscode';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getGitHubSession } from './auth';
import { LocalStorageWatcher } from './watcher';
import { GitHubGistProvider } from './gistProvider';
import { CustomServerProvider } from './customServerProvider';
import { IStorageProvider } from './storage';

let statusBarItem: vscode.StatusBarItem;
let autoSyncEnabled = true;
let watcher: LocalStorageWatcher;
let storageProvider: IStorageProvider;
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
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('contextgap.storageMethod') || e.affectsConfiguration('contextgap.customServerUrl')) {
            updateStorageProvider();
        }
    });

    const workspaceFolders = vscode.workspace.workspaceFolders;
    // Use the workspace NAME (folder name) instead of absolute path so it syncs across different devices
    const workspaceName = workspaceFolders ? workspaceFolders[0].name : 'no-workspace';
    workspaceId = crypto.createHash('md5').update(workspaceName).digest('hex');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'contextgap.syncNow';
    updateStatusBar();
    statusBarItem.show();
    
    watcher = new LocalStorageWatcher(context, async () => {
        if (autoSyncEnabled && !isSyncing) {
            await pushState(watcher.getDbPath());
        }
    });
    watcher.startWatching();

    let pushCmd = vscode.commands.registerCommand('contextgap.push', async () => {
        await pushState(watcher.getDbPath());
    });

    let pullCmd = vscode.commands.registerCommand('contextgap.pull', async () => {
        await pullState(watcher.getDbPath());
    });

    let syncNowCmd = vscode.commands.registerCommand('contextgap.syncNow', async () => {
        vscode.window.showInformationMessage('ContextGap: Syncing manually...');
        await pushState(watcher.getDbPath());
    });

    let toggleAutoSyncCmd = vscode.commands.registerCommand('contextgap.toggleAutoSync', () => {
        autoSyncEnabled = !autoSyncEnabled;
        updateStatusBar();
        vscode.window.showInformationMessage(`ContextGap Auto-Sync is now ${autoSyncEnabled ? 'ON' : 'OFF'}`);
    });

    context.subscriptions.push(pushCmd, pullCmd, syncNowCmd, toggleAutoSyncCmd, statusBarItem);
    
    // Automatically try to pull when workspace is opened
    pullState(watcher.getDbPath());
}

async function pushState(dbPath: string | undefined) {
    if (!dbPath || !fs.existsSync(dbPath)) return;
    try {
        isSyncing = true;
        statusBarItem.text = '$(sync~spin) ContextGap: Pushing...';
        const fileData = fs.readFileSync(dbPath).toString('base64');
        await storageProvider.push(workspaceId, { fileData, timestamp: Date.now() });
        updateStatusBar();
    } catch (e) {
        vscode.window.showErrorMessage('ContextGap: Failed to push state to GitHub.');
        updateStatusBar();
    } finally {
        isSyncing = false;
    }
}

async function pullState(dbPath: string | undefined) {
    if (!dbPath) return;
    try {
        isSyncing = true;
        statusBarItem.text = '$(sync~spin) ContextGap: Pulling...';
        const payload = await storageProvider.pull(workspaceId);
        
        // Basic conflict check: Only pull if the local DB is older or doesn't exist
        if (payload && payload.fileData) {
            const localStat = fs.existsSync(dbPath) ? fs.statSync(dbPath).mtimeMs : 0;
            if (payload.timestamp > localStat) {
                fs.writeFileSync(dbPath, Buffer.from(payload.fileData, 'base64'));
                vscode.window.showInformationMessage('ContextGap: AI Context Restored!');
            }
        }
        updateStatusBar();
    } catch (e) {
        vscode.window.showErrorMessage('ContextGap: Failed to pull state from GitHub.');
        updateStatusBar();
    } finally {
        isSyncing = false;
    }
}

function updateStatusBar() {
    if (autoSyncEnabled) {
        statusBarItem.text = '$(sync) ContextGap: Auto';
        statusBarItem.tooltip = 'Auto-Sync is ON. Click to sync manually.';
    } else {
        statusBarItem.text = '$(cloud) ContextGap: Manual';
        statusBarItem.tooltip = 'Auto-Sync is OFF. Click to sync manually.';
    }
}

export function deactivate() {
    if (watcher) watcher.stopWatching();
}
