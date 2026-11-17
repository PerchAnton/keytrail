import { test as base, expect } from '@playwright/test';
import { startServer } from './server.mjs';
export const test = base.extend({ appURL: [async ({}, use) => {
  const server = await startServer();
  try { await use(server.url); } finally { await server.close(); }
}, { scope: 'worker' }] });
export { expect };
export async function reach(page, target, limit = 64) {
  for (let n = 0; n < limit; n++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard entry did not reach the target');
}
