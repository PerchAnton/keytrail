import { test } from 'node:test';
import assert from 'node:assert/strict';
import { report } from '../guard/report.mjs';
import { inspectReport, semanticSignatures } from '../../verification/signatures.mjs';
function fixture() {
  const value = report('fixture-id');
  return { config: { workers: 1 }, errors: [], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [{ specs: [{ id: 'fixture-id', file: 'dialog.spec.ts', title: 'fixture', tests: [{ expectedStatus: 'passed',
      results: [{ status: 'passed', retry: 0, attachments: [{ name: 'journey-result.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(value)).toString('base64') }] }] }] }] }] };
}
test('reliability evidence rejects attachment mixing, retries, missing cases and repeated run identities', () => {
  const value = fixture(), seen = new Set();
  assert.equal(inspectReport(value, 1, seen).length, 1);
  assert.throws(() => inspectReport(value, 2), /WORKER_COUNT/);
  assert.throws(() => inspectReport(value, 1, seen), /REUSED_RUN_ID/);
  const wrong = fixture(); wrong.suites[0].specs[0].id = 'different';
  assert.throws(() => inspectReport(wrong, 1), /MIXED_TEST_ATTACHMENT/);
  const retry = fixture(); retry.suites[0].specs[0].tests[0].results.push(retry.suites[0].specs[0].tests[0].results[0]);
  assert.throws(() => inspectReport(retry, 1), /RETRY/);
  const missing = fixture(); missing.suites = [];
  assert.throws(() => inspectReport(missing, 1), /CASE_COUNT/);
});
test('reliability signatures ignore timing while preserving observations, codes and dependencies', () => {
  const original = inspectReport(fixture(), 1), changed = structuredClone(original);
  changed[0].checks[0].observed.focus = 'outside';
  assert.notDeepEqual(semanticSignatures(original), semanticSignatures(changed));
  const trace = structuredClone(original); trace[0].actionTrace[0].stepId = 'step-002';
  assert.deepEqual(semanticSignatures(original), semanticSignatures(trace));
});

function engineFixture(title) {
  const value = fixture();
  const spec = value.suites[0].specs[0];
  spec.file = 'observations.spec.ts';
  spec.title = title;
  spec.tests[0].results[0].attachments = [];
  return value;
}
for (const variant of ['extra-match', 'rebound', 'swapped-ids']) {
  test(`reliability accepts the grouped manual read regression: ${variant}`, () => {
    const title = `grouped manual reads resolve the original locator after ${variant}`;
    assert.deepEqual(inspectReport(engineFixture(title), 1), [
      { id: 'fixture-id', file: 'observations.spec.ts', title, kind: 'engine-observation' },
    ]);
  });
}
test('reliability rejects an unknown engine case, including a similar grouped read name', () => {
  for (const title of ['unknown engine case', 'grouped manual reads resolve the original locator after unknown']) {
    assert.throws(() => inspectReport(engineFixture(title), 1), /UNRECOGNIZED_ENGINE_CASE/);
  }
});
test('reliability accepts the single-request and live-membership regressions', () => {
  for (const title of [
    'grouped manual reads resolve targets and roles in one fresh request',
    'grouped manual reads detect missing-target without DOM mutations',
    'grouped manual reads detect missing-role without DOM mutations',
    'grouped manual reads detect added-role without DOM mutations',
    'grouped manual reads reject mutations between resolution and the atomic callback',
  ]) assert.equal(inspectReport(engineFixture(title), 1)[0].kind, 'engine-observation');
});
test('known engine cases still reject retries and unexpected journey attachments', () => {
  const title = 'grouped manual reads resolve the original locator after rebound';
  const retry = engineFixture(title);
  retry.suites[0].specs[0].tests[0].results[0].retry = 1;
  assert.throws(() => inspectReport(retry, 1), /RETRY/);
  const attachment = engineFixture(title);
  attachment.suites[0].specs[0].tests[0].results[0].attachments = [{ name: 'journey-result.json' }];
  assert.throws(() => inspectReport(attachment, 1), /ENGINE_ATTACHMENT/);
});

test('reliability accepts every complete-read regression and rejects an unknown variant', () => {
  for (const suffix of [
    'resolve the original locator after extra-match', 'resolve the original locator after rebound',
    'resolve the original locator after swapped-ids', 'resolve targets and roles in one fresh request',
    'detect missing-target without DOM mutations', 'detect missing-role without DOM mutations',
    'detect added-role without DOM mutations', 'reject mutations between resolution and the atomic callback',
  ]) assert.equal(inspectReport(engineFixture(`grouped complete reads ${suffix}`), 1)[0].kind, 'engine-observation');
  assert.throws(() => inspectReport(engineFixture('grouped complete reads resolve the original locator after unknown'), 1), /UNRECOGNIZED_ENGINE_CASE/);
});
