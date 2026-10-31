import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeObservations } from '../summarize-observations.mjs';

const attachment = (name, value) => ({ name, body: Buffer.from(JSON.stringify(value)).toString('base64') });
const report = (status, attachments) => ({ stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'passed' ? 0 : 1 },
  suites: [{ suites: [{ specs: [{ title: 'tabs canary', tests: [{ results: [{ status, retry: 0, attachments }] }] }] }] }] });
const journey = { outcome: 'blocked', checks: [{ checkId: 'T05.forward.001.unchanged', status: 'blocked',
  messageCode: 'OBSERVATION_GAP', observed: { observationCount: 2, observationWindowMs: 129.8, maxObservationGapMs: 129.8 } }] };

test('failed canary remains a failure when timing diagnostics are missing', () => {
  const r = summarizeObservations(report('failed', [attachment('journey-result.json', journey)]));
  assert.equal(r.failedTests.length, 1);
  assert.equal(r.failedTests[0].failure, 'OBSERVATION_GAP');
  assert.equal(r.failedTests[0].timingAttachment, false);
  assert.equal(r.failedTests[0].windows[0].gapMs, 129.8);
});

test('a failed test without attachments is not omitted from diagnostics', () => {
  const r = summarizeObservations(report('failed', []));
  assert.equal(r.failedTests.length, 1);
  assert.equal(r.failedTests[0].status, 'failed');
  assert.equal(r.failedTests[0].timingAttachment, false);
  assert.deepEqual(r.failedTests[0].windows, []);
});

test('an expected gap regression stays a passing test with a blocked journey', () => {
  const r = summarizeObservations(report('passed', [attachment('journey-result.json', journey)]));
  assert.equal(r.failedTests.length, 0);
  assert.equal(r.tests[0].outcome, 'blocked');
  assert.equal(r.tests[0].failure, 'OBSERVATION_GAP');
});

test('diagnostic durations do not subtract host and browser clock origins', () => {
  const timings = { readings: [{ window: 1, intervalMs: 129.8, durationMs: 128, hostGapBeforeMs: 1.8,
    resolutionMs: [127, 126], resolutions: [
      { startedMs: 8000, finishedMs: 8127, browserStartedAt: 23, browserFinishedAt: 24 },
      { startedMs: 8002, finishedMs: 8128, browserStartedAt: 25, browserFinishedAt: 27 },
    ] }] };
  const r = summarizeObservations(report('failed', [attachment('journey-result.json', journey), attachment('snapshot-timings.json', timings)]));
  assert.deepEqual(r.tests[0].slowest[0], { window: 1, intervalMs: 129.8, snapshotMs: 128, hostGapBeforeMs: 1.8,
    dispatchSpanMs: 2, longestResolutionMs: 127, browserCallbackSpanMs: 4, longestBrowserCallbackMs: 2 });
});
