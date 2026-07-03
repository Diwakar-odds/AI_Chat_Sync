/**
 * VsCodeAdapter.ts
 * 
 * Handles chat sync for VS Code (GitHub Copilot) and Cursor IDE.
 * Both IDEs use the EXACT same SQLite-based storage format (state.vscdb).
 * 
 * VS Code:  %APPDATA%/Code/User/workspaceStorage/<hash>/state.vscdb
 * Cursor:   %APPDATA%/Cursor/User/workspaceStorage/<hash>/state.vscdb
 * 
 * Detection:
 *   - Cursor: process.env.CURSOR_TRACE_ID exists
 *   - VS Code: default VS Code environment
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IIdeAdapter, ChatSession } from './IdeAdapter';

export class VsCodeAdapter implements IIdeAdapter {
    readonly ideName: string;
    private appName: string;

    constructor(isCursor: boolean = false) {
        this.ideName = isCursor ? 'Cursor IDE' : 'VS Code';
        this.appName = isCursor ? 'Cursor' : 'Code';
    }

    private getWorkspaceStorageDir(): string {
        const appData = process.env.APPDATA || path.join(os.homedir(), '.config');
        return path.join(appData, this.appName, 'User', 'workspaceStorage');
    }

    async getWatchPath(): Promise<string | undefined> {
        const storageDir = this.getWorkspaceStorageDir();
        if (!fs.existsSync(storageDir)) return undefined;

        // Find the most recently modified state.vscdb across all workspace hashes
        try {
            const hashDirs = fs.readdirSync(storageDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => path.join(storageDir, d.name, 'state.vscdb'))
                .filter(p => fs.existsSync(p));

            if (hashDirs.length === 0) return undefined;

            // Return the most recently modified one
            return hashDirs.sort((a, b) => {
                return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
            })[0];
        } catch {
            return undefined;
        }
    }

    async readChats(): Promise<ChatSession[] | null> {
        // We sync the raw vscdb file as binary (base64) since it's a SQLite DB.
        // The actual SQL parsing would require a native sqlite3 module.
        // For now, we return metadata about what we're syncing.
        const watchPath = await this.getWatchPath();
        if (!watchPath || !fs.existsSync(watchPath)) return null;

        const stat = fs.statSync(watchPath);
        return [{
            id: `${this.appName.toLowerCase()}-workspace`,
            title: `${this.ideName} Workspace Chat`,
            messages: [],
            workspaceName: this.ideName,
            lastUpdated: stat.mtimeMs
        }];
    }

    async writeChats(_sessions: ChatSession[]): Promise<void> {
        // VS Code / Cursor: restore is handled at the binary file level by extension.ts
        // (we push/pull the raw state.vscdb file as base64)
        console.log(`ContextGap: ${this.ideName} chat restore handled via binary file sync.`);
    }

    /** Returns the raw binary path for full file-level sync */
    async getRawDbPath(): Promise<string | undefined> {
        return this.getWatchPath();
    }
}
