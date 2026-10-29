export function startServer(port?: number): Promise<{ url: string; close(): Promise<void> }>;
