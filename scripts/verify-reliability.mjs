import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { cpus, platform, arch, release } from 'node:os';
import { inputHashes } from '../verification/inputs.mjs';
import { digest, inspectReport, semanticSignatures } from '../verification/signatures.mjs';

const args = process.argv.slice(2);
assert(args.every(arg => ['--smoke', '--new-series', '--workers=2'].includes(arg)), 'Unknown option');
const rounds = args.includes('--smoke') ? 1 : 100;
const workers = args.includes('--workers=2') ? 2 : 1;
const require = createRequire(import.meta.url), cli = require.resolve('@playwright/test/cli');
const inputs = await inputHashes();
const browser = await chromium.launch();
let browserVersion;
try { browserVersion = browser.version(); } finally { await browser.close(); }
const environment = { node: process.versions.node, platform: platform(), release: release(), arch: arch(),
  cpu: cpus()[0].model, logicalCpus: cpus().length, playwright: require('@playwright/test/package.json').version, chromium: browserVersion };
const identity = digest({ inputs, environment, workers });
await mkdir('artifacts/reliability', { recursive: true });
const latestPath = 'artifacts/reliability/latest.json';
let latest;
try { latest = JSON.parse(await readFile(latestPath, 'utf8')); } catch {}
const fresh = !latest || latest.identity !== identity || args.includes('--new-series') || latest.smoke !== (rounds === 1);
const folder = fresh ? `artifacts/reliability/${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${identity.slice(0, 12)}` : latest.folder;
await mkdir(folder, { recursive: true });
async function atomic(path, data) { await writeFile(path + '.tmp', JSON.stringify(data, null, 2) + '\n'); await rename(path + '.tmp', path); }
let checkpoint;
if (!fresh) checkpoint = JSON.parse(await readFile(join(folder, 'checkpoint.json'), 'utf8'));
else checkpoint = { startedAt: new Date().toISOString(), identity, environment, sourceHashes: inputs, smoke: rounds === 1,
  targetRounds: rounds, workers, retries: 0, status: 'running', rounds: [] };
assert.equal(checkpoint.workers, workers, 'CHECKPOINT_WORKERS');
assert.notEqual(checkpoint.status, 'failed', 'Failed series is retained. Diagnose it, then use --new-series; failures cannot be skipped.');
await atomic(latestPath, { identity, folder, smoke: rounds === 1 });
const seen = new Set();
let baseline;
// Revalidate saved rounds instead of trusting the checkpoint counter.
for (let index = 0; index < checkpoint.rounds.length; index++) {
  const report = JSON.parse(await readFile(join(folder, `round-${String(index + 1).padStart(3, '0')}.json`), 'utf8'));
  const cases = inspectReport(report, workers, seen, environment), stable = semanticSignatures(cases);
  if (!baseline) baseline = stable; else assert.deepEqual(stable, baseline, 'SAVED_ROUND_DIVERGED');
  assert.equal(digest(stable), checkpoint.rounds[index].signature, 'CHECKPOINT_MISMATCH');
}
async function runReport(file, workers) {
  const reportPath = resolve(folder, file + '.json'), log = createWriteStream(join(folder, file + '.log'));
  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath, CI: '1' };
  delete env.FORCE_COLOR; delete env.NO_COLOR;
  const child = spawn(process.execPath, [cli, 'test', '--workers', String(workers), '--retries', '0', '--reporter', 'json'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 15 * 60 * 1000);
  const exit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => resolve(signal ?? code)); });
  clearTimeout(timeout); log.end();
  assert.equal(exit, 0, `RUN_EXIT:${file}:${exit}`);
  return JSON.parse(await readFile(reportPath, 'utf8'));
}
try {
  await atomic(join(folder, 'checkpoint.json'), checkpoint);
  for (let round = checkpoint.rounds.length + 1; round <= rounds; round++) {
    assert.deepEqual(await inputHashes(), inputs, 'INPUT_CHANGED_BEFORE_ROUND');
    const report = await runReport(`round-${String(round).padStart(3, '0')}`, workers);
    assert.deepEqual(await inputHashes(), inputs, 'INPUT_CHANGED_DURING_ROUND');
    const cases = inspectReport(report, workers, seen, environment), stable = semanticSignatures(cases);
    if (!baseline) { baseline = stable; await atomic(join(folder, 'baseline.json'), stable); }
    else assert.deepEqual(stable, baseline, `SEMANTIC_DIFFERENCE:round-${round}`);
    checkpoint.rounds.push({ round, tests: cases.length, passed: report.stats.expected, signature: digest(stable), durationMs: report.stats.duration });
    checkpoint.lastCompletedAt = new Date().toISOString();
    await atomic(join(folder, 'checkpoint.json'), checkpoint);
    console.log(`Round ${round}/${rounds}: ${cases.length} passed on ${workers} worker(s), unchanged semantics, no retries.`);
  }
  if (workers !== 1) {
    const single = await runReport('workers1', 1);
    assert.deepEqual(await inputHashes(), inputs, 'INPUT_CHANGED_DURING_SINGLE_WORKER_RUN');
    const cases = inspectReport(single, 1, seen, environment);
    assert.deepEqual(semanticSignatures(cases), baseline, 'SINGLE_WORKER_DIFFERENCE');
    checkpoint.singleWorker = { workers: 1, passed: single.stats.expected,
      signature: digest(semanticSignatures(cases)), durationMs: single.stats.duration };
  }
  const parallel = await runReport('workers4', 4);
  assert.deepEqual(await inputHashes(), inputs, 'INPUT_CHANGED_DURING_ISOLATION_RUN');
  const cases = inspectReport(parallel, 4, seen, environment);
  assert.deepEqual(semanticSignatures(cases), baseline, 'WORKER_ISOLATION_DIFFERENCE');
  checkpoint.parallel = { workers: 4, passed: parallel.stats.expected, signature: digest(semanticSignatures(cases)), durationMs: parallel.stats.duration };
  checkpoint.finishedAt = new Date().toISOString(); checkpoint.status = 'passed';
  checkpoint.caseCount = baseline.length; checkpoint.totalSequentialExecutions = rounds * baseline.length;
  checkpoint.uniqueJourneyRunIds = seen.size;
  checkpoint.acceptance = rounds === 100;
  await atomic(join(folder, 'checkpoint.json'), checkpoint);
  const proof = { package: 'keytrail', version: JSON.parse(await readFile('package.json', 'utf8')).version, ...checkpoint, cases: baseline };
  await atomic('artifacts/reliability-verification.json', proof);
  console.log(`Verified ${checkpoint.totalSequentialExecutions} sequential fixture executions and ${cases.length} parallel checks. Full acceptance: ${checkpoint.acceptance}.`);
} catch (error) {
  checkpoint.status = 'failed'; checkpoint.failedAt = new Date().toISOString();
  checkpoint.failure = error instanceof Error ? error.message.slice(0, 2000) : 'UNKNOWN_VERIFICATION_FAILURE';
  await atomic(join(folder, 'checkpoint.json'), checkpoint);
  throw error;
}
