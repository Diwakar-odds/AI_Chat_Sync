import * as vscode from 'vscode';

const GITHUB_AUTH_PROVIDER_ID = 'github';
const SCOPES = ['gist', 'user:email'];

export async function getGitHubSession(): Promise<vscode.AuthenticationSession | undefined> {
    try {
        // This will prompt the user to log in to GitHub via VS Code's native UI
        const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
        if (session) {
            vscode.window.showInformationMessage(`ContextGap: Logged in as ${session.account.label}`);
        }
        return session;
    } catch (error) {
        vscode.window.showErrorMessage('Failed to authenticate with GitHub for ContextGap.');
        return undefined;
    }
}
