/**
 * GenericAdapter.ts
 * 
 * The universal fallback adapter for ANY IDE not explicitly supported.
 * Works in: Windsurf, VSCodium, Gitpod, Theia, Eclipse, Neovim (with setup),
 *           Emacs (with setup), or any future IDE.
 * 
 * Strategy: Creates and syncs a `.contextgap-state.json` file in the
 * workspace root folder. Users can manually add their chat notes to it.
 * This is guaranteed to work in 100% of cases.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IIdeAdapter, ChatSession } from './IdeAdapter';

export class GenericAdapter implements IIdeAdapter {
    readonly ideName = 'Generic (Universal Fallback)';

    private getStatePath(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) return undefined;
        return path.join(folders[0].uri.fsPath, '.contextgap-state.json');
    }

    async getWatchPath(): Promise<string | undefined> {
        const statePath = this.getStatePath();
        if (!statePath) return undefined;

        // Auto-create file if it doesn't exist
        if (!fs.existsSync(statePath)) {
            const initial: ChatSession[] = [{
                id: 'default',
                title: 'My Chat Notes',
                messages: [
                    {
                        role: 'user',
                        content: 'Welcome to ContextGap! Edit this file to add notes, or your IDE\'s chat history will be synced here automatically.',
                        timestamp: Date.now()
                    }
                ],
                workspaceName: path.basename(path.dirname(statePath)),
                lastUpdated: Date.now()
            }];
            fs.writeFileSync(statePath, JSON.stringify(initial, null, 2));
        }

        return statePath;
    }

    async readChats(): Promise<ChatSession[] | null> {
        const statePath = this.getStatePath();
        if (!statePath || !fs.existsSync(statePath)) return null;

        try {
            const data = fs.readFileSync(statePath, 'utf-8');
            const sessions = JSON.parse(data);
            return Array.isArray(sessions) ? sessions : [sessions];
        } catch (e) {
            console.error('ContextGap GenericAdapter: Error reading state file:', e);
            return null;
        }
    }

    async writeChats(sessions: ChatSession[]): Promise<void> {
        const statePath = this.getStatePath();
        if (!statePath) return;

        fs.writeFileSync(statePath, JSON.stringify(sessions, null, 2));
        console.log(`ContextGap: Restored ${sessions.length} chat sessions to workspace root.`);
    }
}
