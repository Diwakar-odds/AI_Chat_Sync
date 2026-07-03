/**
 * AntigravityAdapter.ts
 * 
 * Handles chat sync for Antigravity IDE.
 * Antigravity stores all conversations as JSONL (JSON Lines) files
 * inside: ~/.gemini/antigravity-ide/brain/<conversation-id>/transcript.jsonl
 * 
 * Detection: process.env.ANTIGRAVITY_AGENT === '1'
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IIdeAdapter, ChatSession, ChatMessage } from './IdeAdapter';

export class AntigravityAdapter implements IIdeAdapter {
    readonly ideName = 'Antigravity IDE';

    private getBrainDir(): string {
        return path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
    }

    async getWatchPath(): Promise<string | undefined> {
        // Watch the entire brain directory for any new conversation files
        const brainDir = this.getBrainDir();
        if (fs.existsSync(brainDir)) {
            return brainDir;
        }
        return undefined;
    }

    async readChats(): Promise<ChatSession[] | null> {
        const brainDir = this.getBrainDir();
        if (!fs.existsSync(brainDir)) {
            return null;
        }

        const sessions: ChatSession[] = [];

        try {
            const conversationDirs = fs.readdirSync(brainDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            for (const convId of conversationDirs) {
                const transcriptPath = path.join(brainDir, convId, 'transcript.jsonl');
                if (!fs.existsSync(transcriptPath)) continue;

                const lines = fs.readFileSync(transcriptPath, 'utf-8')
                    .split('\n')
                    .filter(l => l.trim());

                const messages: ChatMessage[] = [];
                let lastUpdated = 0;

                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        if (entry.type === 'USER_INPUT' && entry.content) {
                            messages.push({
                                role: 'user',
                                content: String(entry.content).slice(0, 2000),
                                timestamp: entry.created_at ? new Date(entry.created_at).getTime() : undefined
                            });
                        } else if (entry.type === 'PLANNER_RESPONSE' && entry.content) {
                            messages.push({
                                role: 'assistant',
                                content: String(entry.content).slice(0, 2000),
                                timestamp: entry.created_at ? new Date(entry.created_at).getTime() : undefined
                            });
                            if (entry.created_at) {
                                lastUpdated = Math.max(lastUpdated, new Date(entry.created_at).getTime());
                            }
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }

                if (messages.length > 0) {
                    sessions.push({
                        id: convId,
                        title: `Antigravity Chat ${convId.slice(0, 8)}`,
                        messages,
                        workspaceName: 'Antigravity',
                        lastUpdated
                    });
                }
            }

            return sessions.length > 0 ? sessions : null;
        } catch (e) {
            console.error('ContextGap AntigravityAdapter: Error reading chats:', e);
            return null;
        }
    }

    async writeChats(sessions: ChatSession[]): Promise<void> {
        // For Antigravity, we write a human-readable summary JSON
        // (we cannot write back native JSONL without risk of corrupting the IDE)
        const brainDir = this.getBrainDir();
        const syncPath = path.join(brainDir, 'contextgap_synced_chats.json');
        fs.writeFileSync(syncPath, JSON.stringify(sessions, null, 2));
        console.log(`ContextGap: Restored ${sessions.length} chat sessions to Antigravity brain dir.`);
    }
}
