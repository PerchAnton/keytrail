import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const cli = fileURLToPath(new URL('../check-release-readiness.mjs', import.meta.url));
const packageCheck = fileURLToPath(new URL('../check-package.mjs', import.meta.url));
const inputs = new URL('../../verification/inputs.mjs', import.meta.url).href;
const hash = value => createHash('sha256').update(value).digest('hex');
const json = async (root, file, value) => writeFile(join(root, file), JSON.stringify(value));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'keytrail-release-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['src', 'tests/guard', 'verification', 'benchmarks', 'schema', 'scripts', 'docs/evidence', 'artifacts']) {
    await mkdir(join(root, dir), { recursive: true });
  }
  // Synthetic metadata exercises validation only; no browser rounds are run.
  for (const file of ['src/example.ts', 'tests/guard/fixture.mjs', 'pnpm-lock.yaml', 'playwright.config.ts', 'schema/journey-result.v1.json', 'scripts/build.mjs', 'scripts/check-guard.mjs', 'scripts/verify-reliability.mjs']) {
    await writeFile(join(root, file), 'synthetic fixture\n');
  }
  await json(root, 'package.json', { name: 'keytrail', version: '0.1.0-alpha.6' });
  const hashes = spawnSync(process.execPath, ['--input-type=module', '-e', `import { inputHashes } from ${JSON.stringify(inputs)}; console.log(JSON.stringify(await inputHashes()))`], { cwd: root, encoding: 'utf8' });
  assert.equal(hashes.status, 0, hashes.stderr);
  const sourceHashes = JSON.parse(hashes.stdout), version = '0.1.0-alpha.6';
  const cases = [{ id: 'synthetic-case' }], signature = hash(JSON.stringify(cases));
  const identity = 'a'.repeat(64);
  await json(root, 'docs/evidence/acceptance-policy.json', { version, seriesIdentity: identity, minimumCompletedRounds: 100, referenceTargetRounds: 100 });
  await json(root, 'docs/evidence/reliability.json', { version, sourceHashes, status: 'passed', acceptance: true, mode: 'final', identity,
    targetRounds: 100, workers: 1, retries: 0, caseCount: 1, cases, totalSequentialExecutions: 100,
    rounds: Array.from({ length: 100 }, (_, i) => ({ round: i + 1, tests: 1, passed: 1, signature })),
    parallel: { workers: 4, passed: 1, signature } });
  for (const kind of ['dialog', 'tabs', 'formErrors']) await json(root, `docs/evidence/benchmark-${kind}.json`, {
    version, sourceHashes, pilot: false, samplesPerArm: 30, warmupsPerArm: 5,
    pairs: Array.from({ length: 30 }, () => ({ keytrailMs: 100, nativeMs: 100 })),
    summary: { targetMet: true, pairedMedianOverheadPercent: 0, ratioOfMediansOverheadPercent: 0 },
  });
  const guardHashes = Object.fromEntries(Object.entries(sourceHashes).filter(([file]) =>
    file.startsWith(`src${sep}`) || file.startsWith(join('tests', 'guard') + sep) ||
    ['scripts/build.mjs', 'schema/journey-result.v1.json'].map(file => join(file)).includes(file)));
  guardHashes[join('scripts', 'check-guard.mjs')] = hash('synthetic fixture\n');
  await json(root, 'docs/evidence/ci-guard.json', { version, sourceHashes: guardHashes,
    cases: [{ case: 'pass', expectedExit: 0, actualExit: 0 }, { case: 'fail', expectedExit: 1, actualExit: 1 }] });
  for (const file of ['package-verification.json', 'SHA256SUMS', 'keytrail-0.1.0-alpha.6.tgz']) {
    await writeFile(join(root, 'artifacts', file), 'preserve this existing artifact\n');
  }
  return root;
}

async function change(root, record, mutate) {
  const file = `docs/evidence/${record}.json`, value = JSON.parse(await readFile(join(root, file), 'utf8'));
  mutate(value); await json(root, file, value);
}
function run(root, args = ['--json']) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.signal, null); assert.ifError(result.error);
  return { ...result, report: result.stdout.startsWith('{') ? JSON.parse(result.stdout) : null };
}
async function snapshot(root) {
  const result = {};
  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path); else result[path] = hash(await readFile(join(root, path)));
    }
  }
  await walk(''); return result;
}

test('readiness is read-only and a valid evidence set still requires the real package gate', async t => {
  const root = await fixture(t), before = await snapshot(root), result = run(root);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.report.evidenceReady, true);
  assert.equal(result.report.checks.length, 6);
  assert(result.report.remaining.some(s => s.includes('check-package.mjs --release')));
  assert.deepEqual(await snapshot(root), before);
});

test('stale source reports all affected gates without deleting artifacts', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'src/example.ts'), 'changed source\n');
  const before = await snapshot(root), result = run(root);
  assert.equal(result.status, 1); assert.equal(result.report.evidenceReady, false);
  assert.equal(result.report.checks.filter(c => c.status === 'blocked').length, 5);
  assert.deepEqual(await snapshot(root), before);
});

for (const [name, record, mutate] of [
  ['short series', 'reliability', e => { e.rounds.length = 4; e.totalSequentialExecutions = 4; }],
  ['development mode', 'reliability', e => { e.mode = 'development'; }],
  ['retry', 'reliability', e => { e.retries = 1; }],
  ['worker mismatch', 'reliability', e => { e.parallel.signature = 'bad'; }],
  ['benchmark pilot', 'benchmark-tabs', e => { e.pilot = true; }],
  ['incorrect benchmark summary', 'benchmark-dialog', e => { e.summary.pairedMedianOverheadPercent = 1; }],
  ['excessive measured overhead', 'benchmark-formErrors', e => {
    e.pairs.forEach(p => { p.keytrailMs = 200; }); e.summary.pairedMedianOverheadPercent = 100; e.summary.ratioOfMediansOverheadPercent = 100;
  }],
  ['guard exit mismatch', 'ci-guard', e => { e.cases[1].actualExit = 0; }],
  ['missing guard hashes', 'ci-guard', e => { delete e.sourceHashes; }],
  ['incomplete guard source coverage', 'ci-guard', e => { delete e.sourceHashes[join('src', 'example.ts')]; }],
  ['missing guard runner hash', 'ci-guard', e => { delete e.sourceHashes[join('scripts', 'check-guard.mjs')]; }],
  ['recording hash masks stale guard source', 'ci-guard', e => {
    const path = join('src', 'example.ts');
    e.recordingSourceHashes = { [path]: e.sourceHashes[path] };
    e.sourceHashes[path] = '0'.repeat(64);
  }],
  ['empty guard cases', 'ci-guard', e => { e.cases = []; }],
  ['duplicate guard cases', 'ci-guard', e => { e.cases.push(e.cases[0]); }],
  ['reduced acceptance policy', 'acceptance-policy', e => { e.minimumCompletedRounds = 4; }],
]) test(`rejects ${name}`, async t => {
  const root = await fixture(t); await change(root, record, mutate);
  const result = run(root); assert.equal(result.status, 1, result.stderr);
  assert.equal(result.report.checks.find(c => c.id === record).status, 'blocked');
});

test('a newly added source cannot be omitted from guard evidence', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'src/new-module.ts'), 'new source\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.checks.find(c => c.id === 'ci-guard').status, 'blocked');
});

test('missing and malformed evidence are reported together', async t => {
  const root = await fixture(t);
  await rm(join(root, 'docs/evidence/reliability.json'));
  await writeFile(join(root, 'docs/evidence/benchmark-tabs.json'), 'invalid json');
  const result = run(root); assert.equal(result.status, 1);
  assert.deepEqual(result.report.checks.filter(c => c.status === 'blocked').map(c => c.id), ['reliability', 'benchmark-tabs']);
});

test('the real release entry point rejects development evidence before packing', async t => {
  const root = await fixture(t); await change(root, 'reliability', e => { e.mode = 'development'; });
  const result = spawnSync(process.execPath, [packageCheck, '--release'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /Final release evidence is not ready/);
  assert.equal(await readFile(join(root, 'artifacts/keytrail-0.1.0-alpha.6.tgz'), 'utf8'), 'preserve this existing artifact\n');
  await assert.rejects(readFile(join(root, 'artifacts/package-verification.json')), { code: 'ENOENT' });
});

test('unknown options fail without changing files', async t => {
  const root = await fixture(t), before = await snapshot(root), result = run(root, ['--final']);
  assert.equal(result.status, 2); assert.match(result.stderr, /Usage:/);
  assert.deepEqual(await snapshot(root), before);
});
