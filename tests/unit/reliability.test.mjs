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
