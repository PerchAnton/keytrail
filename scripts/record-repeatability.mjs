import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

assert(process.argv.length <= 3 && (!process.argv[2] || ['tabs', 'forms'].includes(process.argv[2])));
const tabs = process.argv[2] === 'tabs', forms = process.argv[2] === 'forms';
const workers = tabs || forms ? 4 : 1, repeats = tabs || forms ? 20 : 100, caseCount = forms ? 10 : tabs ? 9 : 8, executions = repeats * caseCount;
const report = JSON.parse(await readFile(forms ? 'artifacts/forms-repeatability-results.json' : tabs ? 'artifacts/tabs-repeatability-results.json' : 'artifacts/repeatability-results.json', 'utf8'));
const baseline = JSON.parse(await readFile('docs/evidence/journeys.json', 'utf8'));
assert.equal(report.config.workers, workers);
assert.equal(report.config.projects[0].repeatEach, repeats);
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
assert.equal(cases.length, caseCount);
for (const fixture of cases) assert.equal(fixture.runs, repeats);
assert.equal(report.stats.expected, executions);
for (const [path, expected] of Object.entries(baseline.sourceHashes)) {
  const actual = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
  assert.equal(actual, expected, `Source changed during repeatability run: ${path}`);
}
const evidence = { recordedAt: new Date().toISOString(), version: baseline.version,
  environment: baseline.environment,
  scope: forms ? '20 repetitions of ten form cases with four workers. Not full-suite repeatability acceptance or a performance benchmark.' : tabs ? '20 repetitions of nine tabs cases with four workers. Not full-suite repeatability acceptance or a performance benchmark.' : '100 sequential repetitions of eight focus regressions. Not full-suite repeatability acceptance or a performance benchmark.',
  workers, repeats, retries: 0, stats: report.stats, sourceHashes: baseline.sourceHashes,
  cases: cases.sort((a, b) => a.fixture.localeCompare(b.fixture)) };
await writeFile(forms ? 'docs/evidence/forms-repeatability.json' : tabs ? 'docs/evidence/tabs-repeatability.json' : 'docs/evidence/repeatability.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`Recorded ${executions} passed executions across ${caseCount} ${forms ? 'form cases' : tabs ? 'tabs cases' : 'focus regressions'}, without retries.`);
