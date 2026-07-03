/**
 * watcher.ts
 * 
 * Watches the IDE's chat storage path (as determined by the active IdeAdapter)
 * for changes and triggers sync callbacks.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { IIdeAdapter } from './adapters/IdeAdapter';

export class LocalStorageWatcher {
    private watcher: fs.FSWatcher | undefined;
    private dbPath: string | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private adapter: IIdeAdapter,
        private onChange: () => void
    ) {}

    public async startWatching() {
        const watchPath = await this.adapter.getWatchPath();

        if (!watchPath) {
            console.warn(`ContextGap [${this.adapter.ideName}]: No watch path found. Open a folder first.`);
            return;
        }

        this.dbPath = watchPath;
        console.log(`ContextGap [${this.adapter.ideName}]: Watching chat state at ${watchPath}`);

        let debounceTimer: NodeJS.Timeout;
        try {
            this.watcher = fs.watch(watchPath, { recursive: false }, (eventType) => {
                if (eventType === 'change' || eventType === 'rename') {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        console.log(`ContextGap [${this.adapter.ideName}]: Detected chat change, syncing...`);
                        this.onChange();
                    }, 2000); // 2s debounce to let writes settle
                }
            });
        } catch (e) {
            console.error(`ContextGap: Failed to watch path ${watchPath}:`, e);
        }
    }

    public stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
        }
    }

    public getDbPath(): string | undefined {
        return this.dbPath;
    }
}
