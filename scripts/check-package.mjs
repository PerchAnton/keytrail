import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const root = process.cwd();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const record of ['journeys', 'repeatability', 'tabs-repeatability']) {
  const evidence = JSON.parse(await readFile(`docs/evidence/${record}.json`, 'utf8'));
  assert.equal(evidence.version, pkg.version);
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    assert(resolve(file).startsWith(root + '/'));
    const actual = createHash('sha256').update((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
    assert.equal(actual, expected, `Refresh ${record} evidence after changing ${file}`);
  }
}
const run = (command, args, cwd) => execFileSync(command, args, { cwd, env: process.env, encoding: 'utf8', timeout: 120000 });
// A container checkout and /tmp may otherwise select different filesystem-local stores.
const storeDirectory = dirname(run('pnpm', ['store', 'path'], root).trim());
run('pnpm', ['pack', '--pack-destination', 'artifacts'], root);
const archive = resolve('artifacts', `${pkg.name}-${pkg.version}.tgz`);
const inventory = run('tar', ['-tzf', archive], root).trim().split('\n');
assert(inventory.every(n => n.startsWith('package/') && !n.split('/').includes('..')));
assert(!inventory.some(n => /node_modules|tests\/|test-results|\.DS_Store|\.npmrc/.test(n)));
assert(inventory.includes('package/LICENSE') && inventory.includes('package/schema/journey-result.v1.json'));
const consumer = await mkdtemp(join(tmpdir(), 'keytrail-consumer-'));
try {
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module',
    dependencies: { keytrail: `file:${archive}`, '@playwright/test': pkg.peerDependencies['@playwright/test'] },
    devDependencies: { typescript: pkg.devDependencies.typescript, '@types/node': pkg.devDependencies['@types/node'] } }));
  run('pnpm', ['install', '--offline', '--ignore-scripts', '--store-dir', storeDirectory], consumer);
  const installed = JSON.parse(await readFile(join(consumer, 'node_modules/keytrail/package.json'), 'utf8'));
  assert.equal(installed.version, pkg.version);
  assert.equal(installed.license, 'Apache-2.0');
  const esm = `import {assertDialogJourney,assertTabsJourney,JourneyAssertionError} from 'keytrail';
import schema from 'keytrail/schema/journey-result.v1.json' with {type:'json'};
if(typeof assertDialogJourney!=='function'||typeof assertTabsJourney!=='function'||typeof JourneyAssertionError!=='function'||!schema.$schema)throw Error('exports');`;
  const cjs = `const {assertDialogJourney,assertTabsJourney,JourneyAssertionError}=require('keytrail');
const schema=require('keytrail/schema/journey-result.v1.json');
if(typeof assertDialogJourney!=='function'||typeof assertTabsJourney!=='function'||typeof JourneyAssertionError!=='function'||!schema.$schema)throw Error('exports');`;
  await writeFile(join(consumer, 'smoke.mjs'), esm);
  await writeFile(join(consumer, 'smoke.cjs'), cjs);
  run(process.execPath, ['smoke.mjs'], consumer);
  run(process.execPath, ['smoke.cjs'], consumer);
  const typed = `import {assertDialogJourney, assertTabsJourney, type DialogContract, type TabsContract} from 'keytrail';
import type {Page,TestInfo} from '@playwright/test';
declare const page:Page, info:TestInfo, contract:DialogContract;
void assertDialogJourney(page,info,contract);
declare const tabs:TabsContract; void assertTabsJourney(page,info,tabs);`;
  await writeFile(join(consumer, 'types.mts'), typed);
  await writeFile(join(consumer, 'types.cts'), typed);
  run('pnpm', ['exec', 'tsc', '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'types.mts', 'types.cts'], consumer);
  await cp(join(root, 'examples/vanilla'), join(consumer, 'example'), { recursive: true });
  const output = run('pnpm', ['exec', 'playwright', 'test', '--config', 'example/playwright.config.ts'], consumer);
  assert.match(output, /4 passed/);
  const bytes = await readFile(archive);
  const proof = { package: pkg.name, version: pkg.version, checkedAt: new Date().toISOString(),
    node: process.version, platform: process.platform, playwright: pkg.peerDependencies['@playwright/test'],
    archive: { file: `${pkg.name}-${pkg.version}.tgz`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), files: inventory.length },
    checks: { evidenceSourceHashes: true, offlineConsumer: true, esm: true, cjs: true, typesEsm: true, typesCjs: true, browserExamples: 4 },
    published: false };
  await writeFile(join(root, 'artifacts/package-verification.json'), JSON.stringify(proof, null, 2)+'\n');
  console.log(JSON.stringify(proof, null, 2));
} finally { await rm(consumer, { recursive: true, force: true }); }
