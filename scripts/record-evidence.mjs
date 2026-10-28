import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

function cases(report) {
  const result = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) {
      assert.equal(test.results.length, 1, 'No retries in this evidence');
      const run = test.results[0];
      assert.equal(run.status, 'passed');
      const attachments = run.attachments.filter(a => a.name === 'journey-result.json');
      if (spec.file.endsWith('observations.spec.ts')) {
        assert.equal(attachments.length, 0);
        result.push({ fixture: spec.title, testPassed: true, kind: 'engine-observation' });
        continue;
      }
      assert.equal(attachments.length, 1);
      const journey = JSON.parse(Buffer.from(attachments[0].body, 'base64').toString());
      result.push({ fixture: spec.title, testPassed: true, journeyOutcome: journey.outcome,
        coverage: journey.coverage,
        checks: journey.checks.map(c => ({ id: c.checkId, status: c.status, code: c.messageCode,
          ...(c.blockedBy ? { blockedBy: c.blockedBy } : {}) })) });
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites) walk(suite);
  return result.sort((a, b) => a.fixture.localeCompare(b.fixture));
}
const one = JSON.parse(await readFile('artifacts/browser-results.json', 'utf8'));
const four = JSON.parse(await readFile('artifacts/browser-results-workers4.json', 'utf8'));
for (const [report, workers] of [[one, 1], [four, 4]]) {
  assert.equal(report.config.workers, workers);
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.unexpected + report.stats.flaky + report.stats.skipped, 0);
  assert(report.stats.expected > 0);
  assert.equal(cases(report).length, report.stats.expected);
}
const outcomes = cases(one);
const parallel = cases(four);
assert.equal(outcomes.length, parallel.length);
for (let index = 0; index < outcomes.length; index++) {
  assert.deepEqual(outcomes[index], parallel[index], `Observation mismatch for ${outcomes[index].fixture}`);
}
const hashes = {};
async function hashDir(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) await hashDir(path);
    else hashes[path] = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
  }
}
await hashDir('src');
await hashDir('tests');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const evidence = { recordedAt: new Date().toISOString(), package: 'keytrail', version: pkg.version,
  environment: { node: process.version, platform: process.platform, arch: process.arch, playwright: '1.64.1', chromium: '156.0.8078.4' },
  scope: 'Synthetic dialog, tabs and form-errors checkpoint, not full 0.1 acceptance, an accessibility audit or a performance benchmark.',
  browsers: { workers1: one.stats, workers4: four.stats, statusesAndCodesIdentical: true },
  sourceHashFormat: 'SHA-256 of UTF-8 text with LF line endings', sourceHashes: hashes, cases: outcomes };
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/journeys.json', JSON.stringify(evidence, null, 2)+'\n');
console.log(`Recorded ${outcomes.length} fixture tests with identical statuses/codes on 1 and 4 workers.`);
