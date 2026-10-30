import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkReactConsumer } from './check-react-consumer.mjs';
import { packageMode } from '../verification/modes.mjs';
import { requireReleaseEvidence } from './lib/release-evidence.mjs';

const root = process.cwd();
const mode = packageMode(process.argv.slice(2));
// Never leave stale success records after a failed release check.
await rm('artifacts/package-verification.json', { force: true });
await rm('artifacts/SHA256SUMS', { force: true });
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
// Development always tests the real archive and both clean consumers. Final
// evidence is an additional, explicit gate; a development result cannot certify it.
if (mode === 'release') await requireReleaseEvidence();
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
const preparation = await mkdtemp(join(tmpdir(), 'keytrail-consumer-preparation-'));
try {
  await writeFile(join(preparation, 'package.json'), JSON.stringify({ private: true, type: 'module',
    dependencies: { keytrail: `file:${archive}`, '@playwright/test': pkg.peerDependencies['@playwright/test'] },
    devDependencies: { typescript: pkg.devDependencies.typescript, '@types/node': pkg.devDependencies['@types/node'] } }));
  // Prepare the dependency graph and registry metadata without installing. A
  // lockfile-free offline resolution can silently omit TypeScript's native
  // optional dependency on a fresh runner. The separate clean consumer must use
  // the frozen graph, including the current platform's compiler package.
  run('pnpm', ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts', '--store-dir', storeDirectory], preparation);
  assert.equal(existsSync(join(preparation, 'node_modules')), false);
  await cp(preparation, consumer, { recursive: true });
  const lock = await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8');
  run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', storeDirectory], consumer);
  assert.equal(await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8'), lock);
  const installed = JSON.parse(await readFile(join(consumer, 'node_modules/keytrail/package.json'), 'utf8'));
  assert.equal(installed.version, pkg.version);
  assert.equal(installed.license, 'Apache-2.0');
  const esm = `import CiGuard from 'keytrail/ci-guard';
if(typeof CiGuard!=='function')throw Error('guard export');
import {assertDialogJourney,assertTabsJourney,assertFormErrorsJourney,JourneyAssertionError} from 'keytrail';
import schema from 'keytrail/schema/journey-result.v1.json' with {type:'json'};
if(typeof assertDialogJourney!=='function'||typeof assertTabsJourney!=='function'||typeof assertFormErrorsJourney!=='function'||typeof JourneyAssertionError!=='function'||!schema.$schema)throw Error('exports');`;
  const cjs = `const CiGuard=require('keytrail/ci-guard').default;
if(typeof CiGuard!=='function')throw Error('guard export');
const {assertDialogJourney,assertTabsJourney,assertFormErrorsJourney,JourneyAssertionError}=require('keytrail');
const schema=require('keytrail/schema/journey-result.v1.json');
if(typeof assertDialogJourney!=='function'||typeof assertTabsJourney!=='function'||typeof assertFormErrorsJourney!=='function'||typeof JourneyAssertionError!=='function'||!schema.$schema)throw Error('exports');`;
  await writeFile(join(consumer, 'smoke.mjs'), esm);
  await writeFile(join(consumer, 'smoke.cjs'), cjs);
  run(process.execPath, ['smoke.mjs'], consumer);
  run(process.execPath, ['smoke.cjs'], consumer);
  const typed = `import CiGuard, {type CiGuardOptions} from 'keytrail/ci-guard';
const options:CiGuardOptions={projectName:'journey'}; new CiGuard(options);
import {assertDialogJourney, assertTabsJourney, assertFormErrorsJourney, type DialogContract, type TabsContract, type FormErrorsContract} from 'keytrail';
import type {Page,TestInfo} from '@playwright/test';
declare const page:Page, info:TestInfo, contract:DialogContract;
void assertDialogJourney(page,info,contract);
declare const tabs:TabsContract; void assertTabsJourney(page,info,tabs);
declare const form:FormErrorsContract; void assertFormErrorsJourney(page,info,form);`;
  await writeFile(join(consumer, 'types.mts'), typed);
  await writeFile(join(consumer, 'types.cts'), typed);
  run('pnpm', ['exec', 'tsc', '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'types.mts', 'types.cts'], consumer);
  await cp(join(root, 'examples/vanilla'), join(consumer, 'example'), { recursive: true });
  run('pnpm', ['exec', 'tsc', '--noEmit', '--strict', '--skipLibCheck', '--types', 'node',
    '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
    'example/profile.journey.spec.ts', 'example/tabs.journey.spec.ts', 'example/form-errors.journey.spec.ts',
    'example/playwright.config.ts', 'example/playwright.guard.config.ts'], consumer);
  const output = run('pnpm', ['exec', 'playwright', 'test', '--config', 'example/playwright.config.ts'], consumer);
  assert.match(output, /6 passed/);
  const guarded = run('pnpm', ['exec', 'playwright', 'test', '--config', 'example/playwright.guard.config.ts'], consumer);
  assert.match(guarded, /3 passed/);
  const react = await checkReactConsumer({ root, archive, storeDirectory, version: pkg.version });
  const bytes = await readFile(archive);
  const proof = { package: pkg.name, version: pkg.version, checkedAt: new Date().toISOString(),
    verificationLevel: mode, finalAcceptance: mode === 'release',
    node: process.version, platform: process.platform, playwright: pkg.peerDependencies['@playwright/test'],
    archive: { file: `${pkg.name}-${pkg.version}.tgz`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), files: inventory.length },
    checks: { evidenceSourceHashes: mode === 'release', offlineConsumer: true, esm: true, cjs: true, typesEsm: true, typesCjs: true, browserExamples: 6, guardedBrowserExamples: 3, guardEsm: true, guardCjs: true },
    consumers: { vanilla: { registryMetadataPreparation: true, offlineInstall: true, frozenDependencyGraph: true, types: true, browserTests: 6, guardedJourneys: 3 }, reactPortal: react },
    published: false };
  await writeFile(join(root, 'artifacts/package-verification.json'), JSON.stringify(proof, null, 2)+'\n');
  await writeFile(join(root, 'artifacts/SHA256SUMS'), `${proof.archive.sha256}  ${proof.archive.file}\n`);
  console.log(JSON.stringify(proof, null, 2));
} finally { await Promise.all([consumer, preparation].map(path => rm(path, { recursive: true, force: true }))); }
