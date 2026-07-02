import { IStorageProvider } from './storage';
import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export class CustomServerProvider implements IStorageProvider {
    private getServerUrl(): string {
        const config = vscode.workspace.getConfiguration('contextgap');
        let url = config.get<string>('customServerUrl') || 'http://localhost:3000';
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        return url;
    }

    private makeRequest(urlStr: string, options: any, data?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const url = new URL(urlStr);
            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            resolve(body);
                        }
                    } else if (res.statusCode === 404) {
                        resolve(null);
                    } else {
                        reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    public async push(workspaceId: string, payload: any): Promise<void> {
        const url = `${this.getServerUrl()}/api/sync/${encodeURIComponent(workspaceId)}`;
        try {
            await this.makeRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, payload);
        } catch (e) {
            console.error('ContextGap Custom Server Push Error:', e);
            throw e;
        }
    }

    public async pull(workspaceId: string): Promise<any> {
        const url = `${this.getServerUrl()}/api/sync/${encodeURIComponent(workspaceId)}`;
        try {
            return await this.makeRequest(url, {
                method: 'GET'
            });
        } catch (e) {
            console.error('ContextGap Custom Server Pull Error:', e);
            throw e;
        }
    }
}
