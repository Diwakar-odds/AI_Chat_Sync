/**
 * IdeAdapter.ts
 * 
 * The shared "blueprint" (interface) that every IDE adapter must implement.
 * This ensures ContextGap's core engine can work with ANY IDE
 * without knowing the specific implementation details.
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

export interface ChatSession {
    id: string;
    title?: string;
    messages: ChatMessage[];
    workspaceName?: string;
    lastUpdated: number;
}

/**
 * Every IDE Adapter MUST implement these 3 methods.
 */
export interface IIdeAdapter {
    /** Human-readable name of the IDE this adapter handles */
    readonly ideName: string;

    /**
     * Returns the file path that this adapter will watch for changes.
     * When this file changes, ContextGap will trigger a sync.
     */
    getWatchPath(): Promise<string | undefined>;

    /**
     * Reads and returns all chat sessions from the IDE's storage.
     * Returns null if nothing is found or readable.
     */
    readChats(): Promise<ChatSession[] | null>;

    /**
     * Restores chat sessions to the IDE's storage.
     * Called during a "pull" operation from GitHub/server.
     */
    writeChats(sessions: ChatSession[]): Promise<void>;
}
