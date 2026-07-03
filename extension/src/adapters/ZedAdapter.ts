/**
 * ZedAdapter.ts
 * 
 * Handles chat sync for Zed Editor.
 * Zed stores AI assistant conversations in:
 *   macOS/Linux: ~/.config/zed/conversations/  (JSON files, older versions)
 *   Newer:       ~/.local/share/zed/  (SQLite DB with Zstd compression)
 * 
 * Detection: process.env.ZED_* or checking VSCODE_CWD for "Zed"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IIdeAdapter, ChatSession, ChatMessage } from './IdeAdapter';

export class ZedAdapter implements IIdeAdapter {
    readonly ideName = 'Zed Editor';

    private getZedConversationsDir(): string {
        const platform = process.platform;
        if (platform === 'win32') {
            return path.join(os.homedir(), 'AppData', 'Roaming', 'Zed', 'conversations');
        } else if (platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'Zed', 'conversations');
        } else {
            return path.join(os.homedir(), '.config', 'zed', 'conversations');
        }
    }

    async getWatchPath(): Promise<string | undefined> {
        const dir = this.getZedConversationsDir();
        return fs.existsSync(dir) ? dir : undefined;
    }

    async readChats(): Promise<ChatSession[] | null> {
        const dir = this.getZedConversationsDir();
        if (!fs.existsSync(dir)) return null;

        const sessions: ChatSession[] = [];

        try {
            const jsonFiles = fs.readdirSync(dir)
                .filter(f => f.endsWith('.json') || f.endsWith('.zed'));

            for (const file of jsonFiles) {
                const filePath = path.join(dir, file);
                try {
                    const raw = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(raw);
                    const messages: ChatMessage[] = [];

                    // Zed stores messages in different formats depending on version
                    const msgArray = data.messages || data.turns || [];
                    for (const msg of msgArray) {
                        if (msg.role && msg.content) {
                            messages.push({
                                role: msg.role === 'user' ? 'user' : 'assistant',
                                content: String(msg.content),
                                timestamp: msg.timestamp
                            });
                        }
                    }

                    if (messages.length > 0) {
                        sessions.push({
                            id: file.replace(/\.(json|zed)$/, ''),
                            title: data.title || data.summary || `Zed Chat ${file.slice(0, 8)}`,
                            messages,
                            workspaceName: 'Zed',
                            lastUpdated: fs.statSync(filePath).mtimeMs
                        });
                    }
                } catch {
                    // Skip malformed files
                }
            }

            return sessions.length > 0 ? sessions : null;
        } catch (e) {
            console.error('ContextGap ZedAdapter: Error reading chats:', e);
            return null;
        }
    }

    async writeChats(sessions: ChatSession[]): Promise<void> {
        const dir = this.getZedConversationsDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        for (const session of sessions) {
            const filePath = path.join(dir, `contextgap_${session.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify({
                title: session.title,
                messages: session.messages,
                timestamp: session.lastUpdated
            }, null, 2));
        }

        console.log(`ContextGap: Wrote ${sessions.length} chat sessions to Zed conversations dir.`);
    }
}
