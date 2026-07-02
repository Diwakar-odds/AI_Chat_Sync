import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LocalStorageWatcher {
    private watcher: fs.FSWatcher | undefined;
    private dbPath: string | undefined;

    constructor(private context: vscode.ExtensionContext, private onChange: () => void) {}

    public startWatching() {
        if (!this.context.storageUri) {
            console.warn('ContextGap: No workspace storage found (Open a folder first).');
            return;
        }

        // VS Code / Cursor storageUri is typically: .../workspaceStorage/<hash>/<extension-name>
        // The main AI chat SQLite DB is typically at: .../workspaceStorage/<hash>/state.vscdb
        const extensionStoragePath = this.context.storageUri.fsPath;
        const workspaceStoragePath = path.dirname(extensionStoragePath);
        this.dbPath = path.join(workspaceStoragePath, 'state.vscdb');

        if (!fs.existsSync(this.dbPath)) {
            console.log(`ContextGap: IDE state DB not found at ${this.dbPath}`);
            return;
        }

        console.log(`ContextGap: Watching AI Chat State at ${this.dbPath}`);
        
        // Watch the SQLite file for changes (Debounce recommended in production)
        let debounceTimer: NodeJS.Timeout;
        this.watcher = fs.watch(this.dbPath, (eventType) => {
            if (eventType === 'change') {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log('ContextGap: Detected AI chat state change!');
                    this.onChange();
                }, 2000); // Wait 2s for DB writes to settle
            }
        });
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
