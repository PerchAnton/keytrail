import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkReactConsumer } from './check-react-consumer.mjs';
import { packageMode } from '../verification/modes.mjs';
import { inputHashes } from '../verification/inputs.mjs';

const root = process.cwd();
const mode = packageMode(process.argv.slice(2));
// Never leave stale success records after a failed release check.
await rm('artifacts/package-verification.json', { force: true });
await rm('artifacts/SHA256SUMS', { force: true });
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
// Development always tests the real archive and both clean consumers. Final
// evidence is an additional, explicit gate; a development result cannot certify it.
if (mode === 'release') {
  const reliabilityPolicy = JSON.parse(await readFile('docs/evidence/acceptance-policy.json', 'utf8'));
  assert.equal(reliabilityPolicy.version, pkg.version);
  assert.equal(reliabilityPolicy.minimumCompletedRounds, 100);
  assert.equal(reliabilityPolicy.referenceTargetRounds, 100);
  for (const record of ['reliability', 'benchmark-dialog', 'benchmark-tabs', 'benchmark-formErrors', 'ci-guard']) {
    const evidence = JSON.parse(await readFile(`docs/evidence/${record}.json`, 'utf8'));
    assert.equal(evidence.version, pkg.version);
    if (record !== 'ci-guard') assert.deepEqual(evidence.sourceHashes, await inputHashes(record.startsWith('benchmark-') ? ['benchmarks'] : []), `Refresh ${record} evidence for the current input set`);
    if (record === 'reliability') {
      assert.equal(evidence.status, 'passed');
      assert.equal(evidence.acceptance, true);
      assert.equal(evidence.mode, 'final');
      assert.equal(evidence.identity, reliabilityPolicy.seriesIdentity);
      assert.equal(evidence.targetRounds, reliabilityPolicy.referenceTargetRounds);
      const completed = evidence.rounds.length;
      assert(completed >= reliabilityPolicy.minimumCompletedRounds && completed <= evidence.targetRounds);
      assert.equal(evidence.acceptance, completed === evidence.targetRounds);
      assert([1, 2].includes(evidence.workers)); assert.equal(evidence.parallel.workers, 4);
      assert.equal(evidence.retries, 0); assert.equal(evidence.totalSequentialExecutions, evidence.caseCount * completed);
      assert(evidence.caseCount > 0); assert.equal(evidence.cases.length, evidence.caseCount);
      const signature = createHash('sha256').update(JSON.stringify(evidence.cases)).digest('hex');
      assert.equal(signature, evidence.parallel.signature);
      assert.equal(evidence.parallel.passed, evidence.caseCount);
      if (evidence.workers === 2) {
        assert.equal(evidence.singleWorker.workers, 1);
        assert.equal(evidence.singleWorker.passed, evidence.caseCount);
        assert.equal(evidence.singleWorker.signature, signature);
      }
      assert(evidence.rounds.every((r, i) => r.round === i + 1 && r.tests === evidence.caseCount && r.passed === evidence.caseCount && r.signature === evidence.parallel.signature));
    } else if (record.startsWith('benchmark-')) {
      assert.equal(evidence.pilot, false); assert.equal(evidence.samplesPerArm, 30);
      assert.equal(evidence.warmupsPerArm, 5); assert.equal(evidence.summary.targetMet, true);
      assert.equal(evidence.pairs.length, 30);
      assert(evidence.pairs.every(p => Number.isFinite(p.keytrailMs) && Number.isFinite(p.nativeMs) && p.keytrailMs > 0 && p.nativeMs > 0));
      const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[14] + sorted[15]) / 2; };
      const paired = median(evidence.pairs.map(p => (p.keytrailMs / p.nativeMs - 1) * 100));
      const ratio = (median(evidence.pairs.map(p => p.keytrailMs)) / median(evidence.pairs.map(p => p.nativeMs)) - 1) * 100;
      assert.equal(paired, evidence.summary.pairedMedianOverheadPercent);
      assert.equal(ratio, evidence.summary.ratioOfMediansOverheadPercent);
      assert(paired <= 20 && ratio <= 20);
    }
    for (const [file, expected] of Object.entries({ ...evidence.sourceHashes, ...evidence.recordingSourceHashes })) {
      assert(resolve(file).startsWith(root + '/'));
      const actual = createHash('sha256').update((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
      assert.equal(actual, expected, `Refresh ${record} evidence after changing ${file}`);
    }
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
