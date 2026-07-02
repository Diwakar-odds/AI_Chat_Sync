export interface IStorageProvider {
    /**
     * Push local AI chat state to the remote storage (e.g., GitHub Gist)
     */
    push(workspaceId: string, payload: any): Promise<void>;
    
    /**
     * Pull remote AI chat state to the local machine
     */
    pull(workspaceId: string): Promise<any>;
}
