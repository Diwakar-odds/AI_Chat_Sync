/**
 * JetBrainsAdapter.ts
 * 
 * Handles chat sync for the ENTIRE JetBrains family of IDEs:
 * IntelliJ IDEA, PyCharm, GoLand, WebStorm, Android Studio, CLion, Rider, etc.
 * 
 * JetBrains AI Assistant stores chat history as XML files:
 * Windows: %APPDATA%/JetBrains/<IDE_VERSION>/workspace/*.xml
 * macOS:   ~/Library/Application Support/JetBrains/<IDE_VERSION>/workspace/
 * Linux:   ~/.config/JetBrains/<IDE_VERSION>/workspace/
 * 
 * Detection: process.env.IDEA_INITIAL_DIRECTORY exists
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IIdeAdapter, ChatSession, ChatMessage } from './IdeAdapter';

export class JetBrainsAdapter implements IIdeAdapter {
    readonly ideName = 'JetBrains IDE';

    private getJetBrainsConfigDir(): string | undefined {
        const platform = process.platform;
        let baseDir: string;

        if (platform === 'win32') {
            baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        } else if (platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Library', 'Application Support');
        } else {
            baseDir = path.join(os.homedir(), '.config');
        }

        const jetbrainsBase = path.join(baseDir, 'JetBrains');
        if (!fs.existsSync(jetbrainsBase)) return undefined;

        // Find the most recent JetBrains IDE config directory
        try {
            const ideDirs = fs.readdirSync(jetbrainsBase, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => path.join(jetbrainsBase, d.name))
                .filter(d => fs.existsSync(path.join(d, 'workspace')));

            if (ideDirs.length === 0) return undefined;
            return ideDirs.sort().reverse()[0]; // Most recent version
        } catch {
            return undefined;
        }
    }

    async getWatchPath(): Promise<string | undefined> {
        const configDir = this.getJetBrainsConfigDir();
        if (!configDir) return undefined;
        return path.join(configDir, 'workspace');
    }

    async readChats(): Promise<ChatSession[] | null> {
        const configDir = this.getJetBrainsConfigDir();
        if (!configDir) return null;

        const workspaceDir = path.join(configDir, 'workspace');
        if (!fs.existsSync(workspaceDir)) return null;

        const sessions: ChatSession[] = [];

        try {
            const xmlFiles = fs.readdirSync(workspaceDir)
                .filter(f => f.endsWith('.xml'));

            for (const xmlFile of xmlFiles) {
                const xmlPath = path.join(workspaceDir, xmlFile);
                const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

                // Extract chat messages from JetBrains XML format
                const messages: ChatMessage[] = [];
                const messageRegex = /<message role="(user|assistant)"[^>]*>([\s\S]*?)<\/message>/gi;
                let match;

                while ((match = messageRegex.exec(xmlContent)) !== null) {
                    messages.push({
                        role: match[1] as 'user' | 'assistant',
                        content: match[2].replace(/<[^>]*>/g, '').trim(),
                        timestamp: Date.now()
                    });
                }

                if (messages.length > 0) {
                    sessions.push({
                        id: xmlFile.replace('.xml', ''),
                        title: xmlFile.replace('.xml', ''),
                        messages,
                        workspaceName: 'JetBrains',
                        lastUpdated: fs.statSync(xmlPath).mtimeMs
                    });
                }
            }

            return sessions.length > 0 ? sessions : null;
        } catch (e) {
            console.error('ContextGap JetBrainsAdapter: Error reading chats:', e);
            return null;
        }
    }

    async writeChats(sessions: ChatSession[]): Promise<void> {
        const configDir = this.getJetBrainsConfigDir();
        if (!configDir) return;

        const workspaceDir = path.join(configDir, 'workspace');
        if (!fs.existsSync(workspaceDir)) return;

        // Write each session as an XML file
        for (const session of sessions) {
            const xmlContent = this.sessionsToXml(session);
            const xmlPath = path.join(workspaceDir, `contextgap_${session.id}.xml`);
            fs.writeFileSync(xmlPath, xmlContent);
        }

        console.log(`ContextGap: Wrote ${sessions.length} chat sessions to JetBrains workspace.`);
    }

    private sessionsToXml(session: ChatSession): string {
        const messagesXml = session.messages.map(m =>
            `    <message role="${m.role}" timestamp="${m.timestamp || 0}">
      <content>${this.escapeXml(m.content)}</content>
    </message>`
        ).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<chatSession id="${session.id}" lastUpdated="${session.lastUpdated}">
  <title>${this.escapeXml(session.title || '')}</title>
  <messages>
${messagesXml}
  </messages>
</chatSession>`;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
