import { test } from 'node:test';
import assert from 'node:assert/strict';
import { report } from '../guard/report.mjs';
import { serializeJourneyResult } from '../../artifacts/unit/serialize.js';
import { validJourneyResult } from '../../artifacts/unit/validate.js';
import CiGuard from '../../dist/ci-guard.js';

function fakeTest(id = 'synthetic') { return { id, expectedStatus: 'passed', parent: { project: () => ({ name: 'journey' }) } }; }
function run(value = report()) { return { retry: 0, status: 'passed', attachments: [{ name: 'journey-result.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(value)) }] }; }
function begin(guard, tests = [fakeTest()]) { guard.onBegin({}, { allTests: () => tests }); }
const full = status => ({ status, startTime: new Date(), duration: 1 });

test('serializer removes unknown fields at every object level without invoking toJSON', () => {
  const value = report();
  const objects = [value, value.run, value.scenario, value.config, value.coverage, value.checks[0],
    value.checks[0].expected, value.checks[0].observed, value.steps[0]];
  for (const object of objects) {
    object.secret = 'synthetic-private-value-canary';
    object.toJSON = () => { throw new Error('synthetic-private-error-canary'); };
  }
  const serialized = serializeJourneyResult(value).toString();
  assert(!serialized.includes('canary'));
  assert(validJourneyResult(JSON.parse(serialized)));
});
test('serializer replaces internal failures with a fixed message', () => {
  const value = report();
  Object.defineProperty(value.run, 'attempt', { get() { throw new Error('synthetic-private-error-canary'); } });
  assert.throws(() => serializeJourneyResult(value), { message: 'REPORT_WRITE_FAILED' });
  const invalid = report(); invalid.steps[0].key = null;
  assert.throws(() => serializeJourneyResult(invalid), { message: 'REPORT_WRITE_FAILED' });
});
test('validator checks dependency references and preserves valid incomplete reports', () => {
  const value = report();
  value.checks[0].status = 'blocked'; value.checks[0].messageCode = 'ENTRY_LIMIT';
  value.checks.push({ ...value.checks[0], checkId: 'D02.visible', ruleId: 'D02', status: 'not_run', messageCode: 'NOT_RUN', blockedBy: 'D01.entry' });
  value.coverage = { planned: 2, passed: 0, failed: 0, blocked: 1, notRun: 1, complete: false, entryEvidence: 'unreached' };
  value.outcome = 'blocked';
  assert(validJourneyResult(value));
  value.checks[1].blockedBy = 'missing'; assert(!validJourneyResult(value));
  value.checks[1].blockedBy = 'D02.visible'; assert(!validJourneyResult(value));
});
test('guard preserves failed, timedout and interrupted run statuses', async () => {
  for (const status of ['failed', 'timedout', 'interrupted']) {
    const guard = new CiGuard(); begin(guard); guard.onTestEnd(fakeTest(), run());
    assert.deepEqual(await guard.onEnd(full(status)), { status });
  }
});
test('guard fails missing attempts and swallowed onBegin errors', async () => {
  for (const suite of [{ allTests: () => [fakeTest()] }, { allTests: () => { throw new Error('private'); } }]) {
    const guard = new CiGuard(); guard.onBegin({}, suite);
    assert.deepEqual(await guard.onEnd(full('passed')), { status: 'failed' });
  }
});
test('duplicate attempts and run IDs cannot produce a passing verdict', async () => {
  const first = fakeTest(), second = fakeTest('second');
  for (const duplicateAttempt of [true, false]) {
    const guard = new CiGuard(); begin(guard, [first, second]);
    const value = report(); guard.onTestEnd(first, run(value));
    if (duplicateAttempt) guard.onTestEnd(first, run(value));
    const another = report('second');
    if (!duplicateAttempt) another.run.runId = value.run.runId;
    guard.onTestEnd(second, run(another));
    assert.deepEqual(await guard.onEnd(full('passed')), { status: 'failed' });
  }
});
test('output errors cannot erase the guard verdict', async () => {
  const guard = new CiGuard(); begin(guard);
  const write = process.stderr.write;
  try {
    process.stderr.write = () => { throw new Error('private'); };
    guard.onError();
  } finally { process.stderr.write = write; }
  guard.onTestEnd(fakeTest(), run());
  assert.deepEqual(await guard.onEnd(full('passed')), { status: 'failed' });
});

test('reports preserve observation evidence and reject unsupported passing windows', () => {
  const value = report(); value.rulesetVersion = '0.4.0'; value.scenario.kind = 'tabs';
  value.checks[0] = { ...value.checks[0], ruleId: 'T05', checkId: 'T05.forward.001.unchanged',
    observed: { observationWindowMs: 200, observationCount: 3, observationIntervalsMs: [100, 100], maxObservationGapMs: 100 } };
  assert(validJourneyResult(value));
  value.checks[0].observed.observationIntervalsMs.toJSON = () => { throw Error('CANARY'); };
  assert.doesNotThrow(() => serializeJourneyResult(value));
  for (const mutate of [
    o => o.observationIntervalsMs = [90, 110], o => o.maxObservationGapMs = 0,
    o => o.observationCount = 2, o => o.observationWindowMs = 400,
    o => { delete o.observationIntervalsMs; },
  ]) {
    const changed = JSON.parse(serializeJourneyResult(value)); mutate(changed.checks[0].observed);
    assert.equal(validJourneyResult(changed), false);
  }
  value.checks[0].observed = { observationWindowMs: 110, observationCount: 2, observationIntervalsMs: [110], maxObservationGapMs: 110 };
  value.checks[0].status = 'blocked'; value.checks[0].messageCode = 'OBSERVATION_GAP';
  value.outcome = 'blocked'; value.coverage = { ...value.coverage, passed: 0, blocked: 1, complete: false };
  assert(validJourneyResult(value));
  value.checks[0].observed.maxObservationGapMs = 100; assert.equal(validJourneyResult(value), false);
});
