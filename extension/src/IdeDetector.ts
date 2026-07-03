/**
 * IdeDetector.ts
 * 
 * The "Brain" of the Universal Adapter System.
 * Auto-detects which IDE ContextGap is running inside and returns
 * the correct adapter for that IDE.
 * 
 * Detection order (most specific → least specific):
 * 1. Antigravity  → ANTIGRAVITY_AGENT env var
 * 2. Cursor       → CURSOR_TRACE_ID env var  
 * 3. Windsurf     → WINDSURF_* env vars
 * 4. Zed          → ZED_* env vars or VSCODE_CWD containing "Zed"
 * 5. JetBrains    → IDEA_INITIAL_DIRECTORY or JetBrains config dir exists
 * 6. VS Code      → Default VS Code environment
 * 7. Generic      → Absolute fallback for any other IDE
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IIdeAdapter } from './adapters/IdeAdapter';
import { AntigravityAdapter } from './adapters/AntigravityAdapter';
import { VsCodeAdapter } from './adapters/VsCodeAdapter';
import { JetBrainsAdapter } from './adapters/JetBrainsAdapter';
import { ZedAdapter } from './adapters/ZedAdapter';
import { GenericAdapter } from './adapters/GenericAdapter';

export interface DetectionResult {
    adapter: IIdeAdapter;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

export function detectIde(): DetectionResult {
    const env = process.env;

    // 1. Antigravity IDE
    if (env.ANTIGRAVITY_AGENT === '1') {
        return {
            adapter: new AntigravityAdapter(),
            confidence: 'high',
            reason: 'ANTIGRAVITY_AGENT environment variable detected'
        };
    }

    // 2. Cursor IDE (uses same storage as VS Code but different AppData path)
    if (env.CURSOR_TRACE_ID || env.CURSOR_SESSION_ID ||
        (env.VSCODE_CWD && env.VSCODE_CWD.toLowerCase().includes('cursor'))) {
        return {
            adapter: new VsCodeAdapter(true),
            confidence: 'high',
            reason: 'Cursor IDE environment detected'
        };
    }

    // 3. Windsurf IDE (Codeium) — uses encrypted .pb files, fallback to generic
    if (env.WINDSURF_APP_ROOT || env.CODEIUM_WINDSURF ||
        (env.VSCODE_CWD && env.VSCODE_CWD.toLowerCase().includes('windsurf'))) {
        // Windsurf's encrypted files can't be parsed, use Generic fallback
        console.log('ContextGap: Windsurf detected. Using Generic adapter (encrypted storage).');
        return {
            adapter: new GenericAdapter(),
            confidence: 'medium',
            reason: 'Windsurf IDE detected — using Generic adapter (Windsurf uses encrypted storage)'
        };
    }

    // 4. Zed Editor
    if (env.ZED_TERM || env.ZED_CUSTOM_SHELL ||
        (env.VSCODE_CWD && env.VSCODE_CWD.toLowerCase().includes('zed'))) {
        return {
            adapter: new ZedAdapter(),
            confidence: 'high',
            reason: 'Zed Editor environment detected'
        };
    }

    // 5. JetBrains IDE family (IntelliJ, PyCharm, GoLand, WebStorm, etc.)
    if (env.IDEA_INITIAL_DIRECTORY || env.JETBRAINS_CLIENT_ID ||
        jetBrainsConfigExists()) {
        return {
            adapter: new JetBrainsAdapter(),
            confidence: 'medium',
            reason: 'JetBrains IDE config directory found'
        };
    }

    // 6. Standard VS Code
    if (env.VSCODE_CWD || env.VSCODE_PID ||
        (env.APPDATA && fs.existsSync(path.join(env.APPDATA, 'Code', 'User')))) {
        return {
            adapter: new VsCodeAdapter(false),
            confidence: 'high',
            reason: 'VS Code environment detected'
        };
    }

    // 7. Generic fallback — works in ANY IDE
    return {
        adapter: new GenericAdapter(),
        confidence: 'low',
        reason: 'Unknown IDE — using Generic fallback adapter'
    };
}

function jetBrainsConfigExists(): boolean {
    const platform = process.platform;
    let baseDir: string;

    if (platform === 'win32') {
        baseDir = process.env.APPDATA || '';
    } else if (platform === 'darwin') {
        baseDir = path.join(os.homedir(), 'Library', 'Application Support');
    } else {
        baseDir = path.join(os.homedir(), '.config');
    }

    return fs.existsSync(path.join(baseDir, 'JetBrains'));
}
