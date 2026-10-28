import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export async function inputHashes(extraDirectories = []) {
  const hashes = {};
  async function walk(dir) {
    for (const file of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, file.name);
      if (file.isDirectory()) await walk(path); else await hash(path);
    }
  }
  async function hash(path) { hashes[path] = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex'); }
  for (const dir of ['src', 'tests', 'verification', ...extraDirectories]) await walk(dir);
  for (const path of ['package.json', 'pnpm-lock.yaml', 'schema/journey-result.v1.json', 'playwright.config.ts', 'scripts/build.mjs', 'scripts/verify-reliability.mjs']) await hash(path);
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}
