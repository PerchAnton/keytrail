import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { inputHashes } from '../../verification/inputs.mjs';

// Reading evidence never builds, runs tests, writes records or publishes.
export async function inspectReleaseEvidence() {
  const cwd = process.cwd();
  const readJSON = async file => JSON.parse(await readFile(resolve(cwd, file), 'utf8'));
  const pkg = await readJSON('package.json');
  const currentHashes = await inputHashes();
  const benchmarkHashes = await inputHashes(['benchmarks']);
  const checks = [];
  const check = async (id, work) => {
    try { await work(); checks.push({ id, status: 'passed' }); }
    catch (error) { checks.push({ id, status: 'blocked', reason: String(error.message).split('\n')[0] }); }
  };
  let policy;
  await check('acceptance-policy', async () => {
    policy = await readJSON('docs/evidence/acceptance-policy.json');
    assert.equal(policy.version, pkg.version, 'Acceptance policy version differs');
    assert.equal(policy.minimumCompletedRounds, 100, 'Final acceptance requires 100 rounds');
    assert.equal(policy.referenceTargetRounds, 100, 'Final target must remain 100 rounds');
    assert.match(policy.seriesIdentity, /^[a-f0-9]{64}$/, 'Missing final series identity');
  });
  for (const record of ['reliability', 'benchmark-dialog', 'benchmark-tabs', 'benchmark-formErrors', 'ci-guard']) {
    await check(record, async () => {
      const evidence = await readJSON(`docs/evidence/${record}.json`);
      assert.equal(evidence.version, pkg.version, `Refresh ${record}: package version differs`);
      if (record !== 'ci-guard') assert.deepEqual(evidence.sourceHashes, record.startsWith('benchmark-') ? benchmarkHashes : currentHashes, `Refresh ${record} evidence for the current input set`);
      if (record === 'reliability') {
        assert.equal(evidence.status, 'passed');
        assert.equal(evidence.acceptance, true);
        assert.equal(evidence.mode, 'final', 'A development series cannot certify final acceptance');
        assert.equal(evidence.identity, policy.seriesIdentity);
        assert.equal(evidence.targetRounds, policy.referenceTargetRounds);
        const completed = evidence.rounds.length;
        assert(completed >= policy.minimumCompletedRounds && completed <= evidence.targetRounds, 'The complete 100-round series is required');
        assert.equal(evidence.acceptance, completed === evidence.targetRounds);
        assert([1, 2].includes(evidence.workers)); assert.equal(evidence.parallel.workers, 4);
        assert.equal(evidence.retries, 0, 'Retries are not accepted'); assert.equal(evidence.totalSequentialExecutions, evidence.caseCount * completed);
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
      if (record === 'ci-guard') {
        // Check the complete input set, not just whichever hashes survived in
        // the saved record. Keep this aligned with check-guard.mjs's recorder.
        const guardPaths = Object.keys(currentHashes).filter(file =>
          file.startsWith(`src${sep}`) || file.startsWith(join('tests', 'guard') + sep) ||
          [join('scripts', 'build.mjs'), join('schema', 'journey-result.v1.json')].includes(file));
        guardPaths.push(join('scripts', 'check-guard.mjs'));
        assert.deepEqual(Object.keys(evidence.sourceHashes ?? {}).sort(), guardPaths.sort(),
          'CI guard evidence must cover the complete current source, fixtures and recorder');
        assert(evidence.cases?.length > 0, 'Missing guard cases');
        assert.equal(new Set(evidence.cases.map(c => c.case)).size, evidence.cases.length, 'Duplicate guard cases');
        assert(evidence.cases.every(c => Number.isInteger(c.expectedExit) && c.actualExit === c.expectedExit), 'Guard exit codes do not match');
      }
      assert(evidence.sourceHashes && Object.keys(evidence.sourceHashes).length > 0, 'Missing source hashes');
      // Validate both maps independently: recording metadata must not override
      // a stale hash in the source evidence.
      for (const [file, expected] of [
        ...Object.entries(evidence.sourceHashes), ...Object.entries(evidence.recordingSourceHashes ?? {}),
      ]) {
        assert(resolve(cwd, file).startsWith(cwd + '/'), 'Evidence path escapes repository');
        const actual = createHash('sha256').update((await readFile(resolve(cwd, file), 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
        assert.equal(actual, expected, `Refresh ${record} evidence after changing ${file}`);
      }
    });
  }
  return { package: pkg.name, version: pkg.version, evidenceReady: checks.every(c => c.status === 'passed'), checks };
}

export async function requireReleaseEvidence() {
  const report = await inspectReleaseEvidence();
  assert(report.evidenceReady, 'Final release evidence is not ready:\n' + report.checks
    .filter(c => c.status === 'blocked').map(c => `- ${c.id}: ${c.reason}`).join('\n'));
  return report;
}
