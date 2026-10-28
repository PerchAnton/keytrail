import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const report = JSON.parse(await readFile('artifacts/repeatability-results.json', 'utf8'));
const baseline = JSON.parse(await readFile('docs/evidence/dialog.json', 'utf8'));
assert.equal(report.config.workers, 1);
assert.equal(report.config.projects[0].repeatEach, 100);
assert.equal(report.stats.unexpected + report.stats.flaky + report.stats.skipped, 0);
assert.deepEqual(report.errors, []);
const byFixture = new Map();
function walk(suite) {
  for (const spec of suite.specs ?? []) {
    const key = `${spec.file}:${spec.title}`;
    const fixture = byFixture.get(key) ?? { fixture: spec.title, runs: 0, passed: 0 };
    for (const test of spec.tests) {
      assert.equal(test.results.length, 1, 'Retries are not repeatability evidence');
      assert.equal(test.results[0].status, 'passed');
      fixture.runs++;
      fixture.passed++;
    }
    byFixture.set(key, fixture);
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of report.suites) walk(suite);
const cases = [...byFixture.values()];
assert.equal(cases.length, 8);
for (const fixture of cases) assert.equal(fixture.runs, 100);
assert.equal(report.stats.expected, 800);
for (const [path, expected] of Object.entries(baseline.sourceHashes)) {
  const actual = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
  assert.equal(actual, expected, `Source changed during repeatability run: ${path}`);
}
const evidence = { recordedAt: new Date().toISOString(), version: baseline.version,
  environment: baseline.environment,
  scope: '100 sequential repetitions of eight focus regressions. Not the full-suite repeatability acceptance criterion or a performance benchmark.',
  workers: 1, repeats: 100, retries: 0, stats: report.stats, sourceHashes: baseline.sourceHashes,
  cases: cases.sort((a, b) => a.fixture.localeCompare(b.fixture)) };
await writeFile('docs/evidence/repeatability.json', JSON.stringify(evidence, null, 2) + '\n');
console.log('Recorded 800 passed executions across eight focus regressions, without retries.');
