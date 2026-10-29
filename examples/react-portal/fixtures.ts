import { test as base, expect } from '@playwright/test';
import { startServer } from './server.mjs';
export const test = base.extend<{}, { appURL: string }>({
  appURL: [async ({}, use) => {
    const server = await startServer();
    try { await use(server.url); } finally { await server.close(); }
  }, { scope: 'worker' }],
});
export { expect };
