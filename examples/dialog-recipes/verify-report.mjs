import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2] || 'artifacts/results.json', 'utf8'));
assert.equal(report.config.workers, 1);
assert.equal(report.stats.expected, 21);
for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(report.stats[key], 0);
assert.deepEqual(report.errors, []);
const journeys = [];
function walk(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) for (const test of spec.tests) {
      assert.equal(test.results.length, 1); const result = test.results[0];
      assert.equal(result.status, 'passed'); assert.equal(result.retry, 0);
      for (const a of result.attachments || []) if (a.name === 'journey-result.json') {
        const j = JSON.parse(Buffer.from(a.body, 'base64').toString('utf8'));
        assert.equal(j.run.attempt, 0); assert.equal(j.packageVersion, '1.0.0');
        journeys.push({ title: spec.title, outcome: j.outcome, firstFailure: j.checks.find(c => c.status === 'fail' || c.status === 'blocked')?.messageCode });
      }
    }
    walk(suite.suites || []);
  }
}
walk(report.suites);
assert.equal(journeys.length, 12);
assert.equal(journeys.filter(j => j.outcome === 'passed').length, 3);
assert.equal(journeys.filter(j => j.outcome === 'failed').length, 9);
console.log(JSON.stringify({ tests: 21, retries: 0, journeys }, null, 2));
