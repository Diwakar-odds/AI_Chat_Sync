import { IStorageProvider } from './storage';
import * as vscode from 'vscode';
import { getGitHubSession } from './auth';

export class GitHubGistProvider implements IStorageProvider {
    private octokit: any | undefined;
    private gistId: string | undefined;
    private gistFilename = 'contextgap-state.json';

    private async ensureOctokit() {
        if (!this.octokit) {
            const session = await getGitHubSession();
            if (!session) {
                throw new Error('Not authenticated with GitHub');
            }
            const { Octokit } = await import('octokit');
            this.octokit = new Octokit({ auth: session.accessToken });
        }
    }

    public async push(workspaceId: string, payload: any): Promise<void> {
        await this.ensureOctokit();
        const content = JSON.stringify(payload);
        
        try {
            if (this.gistId) {
                await this.octokit!.rest.gists.update({
                    gist_id: this.gistId,
                    files: {
                        [this.gistFilename]: { content }
                    }
                });
            } else {
                const gists = await this.octokit!.rest.gists.list();
                const existing = gists.data.find((g: any) => g.description === `ContextGap Backup: ${workspaceId}`);
                
                if (existing) {
                    this.gistId = existing.id;
                    await this.push(workspaceId, payload); 
                } else {
                    const res = await this.octokit!.rest.gists.create({
                        description: `ContextGap Backup: ${workspaceId}`,
                        public: false,
                        files: {
                            [this.gistFilename]: { content }
                        }
                    });
                    this.gistId = res.data.id;
                }
            }
        } catch (e) {
            console.error('ContextGap Push Error:', e);
            throw e;
        }
    }

    public async pull(workspaceId: string): Promise<any> {
        await this.ensureOctokit();
        try {
            if (!this.gistId) {
                const gists = await this.octokit!.rest.gists.list();
                const existing = gists.data.find((g: any) => g.description === `ContextGap Backup: ${workspaceId}`);
                if (existing) {
                    this.gistId = existing.id;
                }
            }

            if (!this.gistId) return null;

            const res = await this.octokit!.rest.gists.get({ gist_id: this.gistId });
            const file = res.data.files?.[this.gistFilename];
            if (file && file.content) {
                return JSON.parse(file.content);
            }
            return null;
        } catch (e) {
            console.error('ContextGap Pull Error:', e);
            throw e;
        }
    }
}
