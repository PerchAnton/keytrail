import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, platform, release, arch } from 'node:os';
import { inputHashes } from '../verification/inputs.mjs';
import { digest, inspectReport, semanticSignatures } from '../verification/signatures.mjs';

// This explicit, version-bound policy records a maintainer-approved scope change.
// It must never turn an ordinary failed test or a retry into passing evidence.
assert.equal(process.argv.length, 4, 'Usage: node scripts/finalize-reliability.mjs <series-folder> <four-worker-report>');
const [folder, parallelPath] = process.argv.slice(2);
const policyPath = 'docs/evidence/acceptance-policy.json';
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const checkpoint = JSON.parse(await readFile(join(folder, 'checkpoint.json'), 'utf8'));
const rounds = checkpoint.rounds.length;
assert.equal(policy.version, pkg.version);
assert.equal(checkpoint.identity, policy.seriesIdentity);
assert.equal(digest({ inputs: checkpoint.sourceHashes, environment: checkpoint.environment }), checkpoint.identity);
assert.equal(checkpoint.targetRounds, policy.referenceTargetRounds);
assert.equal(checkpoint.workers, 1); assert.equal(checkpoint.retries, 0); assert.equal(checkpoint.smoke, false);
assert(Number.isInteger(policy.minimumCompletedRounds) && policy.minimumCompletedRounds > 0);
assert(rounds >= policy.minimumCompletedRounds && rounds < checkpoint.targetRounds);
assert.equal(checkpoint.status, 'failed');
const interruptedRound = rounds + 1;
assert(checkpoint.failure.startsWith(`RUN_EXIT:round-${String(interruptedRound).padStart(3, '0')}:130\n`), 'NOT_A_REQUESTED_INTERRUPT');
assert.deepEqual(await inputHashes(), checkpoint.sourceHashes, 'SOURCE_CHANGED');
assert.equal(checkpoint.environment.node, process.versions.node);
assert.equal(checkpoint.environment.platform, platform()); assert.equal(checkpoint.environment.release, release());
assert.equal(checkpoint.environment.arch, arch()); assert.equal(checkpoint.environment.cpu, cpus()[0].model);
assert.equal(checkpoint.environment.logicalCpus, cpus().length);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const seen = new Set(), records = [];
let baseline;
for (let index = 0; index < rounds; index++) {
  const bytes = await readFile(join(folder, `round-${String(index + 1).padStart(3, '0')}.json`));
  const report = JSON.parse(bytes), cases = inspectReport(report, 1, seen, checkpoint.environment);
  const stable = semanticSignatures(cases), saved = checkpoint.rounds[index];
  if (!baseline) baseline = stable; else assert.deepEqual(stable, baseline, 'ROUND_DIVERGED');
  assert.equal(saved.round, index + 1); assert.equal(saved.tests, cases.length); assert.equal(saved.passed, report.stats.expected);
  assert.equal(saved.signature, digest(stable)); assert.equal(saved.durationMs, report.stats.duration);
  records.push({ ...saved, rawReportSha256: hash(bytes) });
}
const stoppedBytes = await readFile(join(folder, `round-${String(interruptedRound).padStart(3, '0')}.json`));
const stopped = JSON.parse(stoppedBytes);
assert.deepEqual(stopped.errors, []); assert.equal(stopped.config.workers, 1);
assert.equal(stopped.stats.unexpected + stopped.stats.flaky, 0, 'FAILURE_BEFORE_INTERRUPT');
let interruptedTests = 0, passedTests = 0, discoveredTests = 0;
function walk(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests) {
    discoveredTests++;
    assert.equal(test.expectedStatus, 'passed'); assert(test.results.length <= 1);
    for (const result of test.results) {
      assert.equal(result.retry, 0);
      assert(['passed', 'skipped', 'interrupted'].includes(result.status), 'FAILURE_BEFORE_INTERRUPT');
      if (result.status === 'interrupted') interruptedTests++;
      if (result.status === 'passed') passedTests++;
    }
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of stopped.suites) walk(suite);
assert.equal(interruptedTests, 1); assert.equal(passedTests, stopped.stats.expected);
assert.equal(discoveredTests, baseline.length);
const parallelBytes = await readFile(parallelPath), parallel = JSON.parse(parallelBytes);
const parallelCases = inspectReport(parallel, 4, seen, checkpoint.environment);
assert.deepEqual(semanticSignatures(parallelCases), baseline, 'WORKER_ISOLATION_DIFFERENCE');
assert.deepEqual(await inputHashes(), checkpoint.sourceHashes, 'SOURCE_CHANGED');
const recordingSourceHashes = {};
for (const path of [policyPath, 'scripts/finalize-reliability.mjs']) recordingSourceHashes[path] = hash((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'));
const proof = {
  package: 'keytrail', version: pkg.version, status: 'verified-partial', acceptance: false,
  scope: policy.reason, policy: policyPath, identity: checkpoint.identity,
  startedAt: checkpoint.startedAt, lastCompletedAt: checkpoint.lastCompletedAt, verifiedAt: new Date().toISOString(),
  targetRounds: checkpoint.targetRounds, completedRounds: rounds, workers: 1, retries: 0,
  environment: checkpoint.environment, sourceHashes: checkpoint.sourceHashes, recordingSourceHashes,
  caseCount: baseline.length, totalSequentialExecutions: rounds * baseline.length, uniqueJourneyRunIds: seen.size,
  rounds: records,
  parallel: { workers: 4, passed: parallel.stats.expected, signature: digest(baseline), durationMs: parallel.stats.duration, rawReportSha256: hash(parallelBytes) },
  excluded: { round: interruptedRound, reason: 'maintainer-requested-stop', exitCode: 130,
    passedBeforeStop: passedTests, interruptedTests, stats: stopped.stats, rawReportSha256: hash(stoppedBytes) },
  cases: baseline,
};
const output = 'artifacts/reliability-verification.json';
await writeFile(output + '.tmp', JSON.stringify(proof, null, 2) + '\n'); await rename(output + '.tmp', output);
console.log(`Verified ${rounds} complete rounds (${proof.totalSequentialExecutions} executions), ${parallelCases.length} four-worker tests, ${seen.size} distinct journey UUIDs. Original ${checkpoint.targetRounds}-round acceptance: false.`);
