import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { report } from './report.mjs';

const mode = process.env.KEYTRAIL_GUARD_CASE;
test('synthetic-private-title-canary', async ({}, info) => {
  if (mode === 'skip') test.skip();
  if (mode === 'fixme') test.fixme();
  if (mode === 'expected-failure') { test.fail(); throw new Error('synthetic-private-error-canary'); }
  if (mode === 'timeout') { test.setTimeout(100); await new Promise(() => {}); }
  if (mode === 'interrupted' || mode === 'global-timeout') {
    writeFileSync(process.env.KEYTRAIL_GUARD_READY, 'ready');
    await new Promise(() => {});
  }
  if (mode === 'retry' && info.retry === 0) throw new Error('synthetic retry');
  if (mode === 'missing' || mode === 'empty-suite') return;
  if (mode === 'write-failure') { await info.attach('journey-result.json', { path: info.outputPath('missing-file') }); return; }
  const value = report(info.testId, info.retry);
  if (mode === 'wrong-test') value.run.testRef = '0'.repeat(64);
  if (mode === 'wrong-attempt') value.run.attempt++;
  if (mode === 'schema') value.schemaVersion = '2';
  if (mode === 'extra-field') value.secret = 'synthetic-private-payload-canary';
  if (mode === 'coverage') value.coverage.passed++;
  if (mode === 'coverage-total') value.coverage.planned++;
  if (mode === 'outcome') value.outcome = 'failed';
  if (mode === 'duplicate-check') { value.checks.push(value.checks[0]); value.coverage.passed++; value.coverage.planned++; }
  if (mode === 'duplicate-step') value.steps.push(value.steps[0]);
  if (mode === 'step-ref') value.checks[0].stepId = 'step-999';
  if (mode === 'code') value.checks[0].messageCode = 'NOT_RUN';
  if (mode === 'check-id') value.checks[0].checkId = 'synthetic-private-payload-canary';
  if (mode === 'rule-family') value.checks[0].ruleId = 'T01';
  if (mode === 'unreached') value.coverage.entryEvidence = 'unreached';
  if (mode === 'action') value.steps[0].key = null;
  if (mode === 'failed-report' || mode === 'incomplete' || (mode === 'retry-incomplete' && info.retry === 0)) {
    value.checks[0].status = mode === 'failed-report' ? 'fail' : 'blocked';
    value.checks[0].messageCode = 'BROWSER_ERROR';
    value.outcome = mode === 'failed-report' ? 'failed' : 'blocked';
    value.coverage.passed = 0;
    value.coverage.failed = mode === 'failed-report' ? 1 : 0;
    value.coverage.blocked = mode !== 'failed-report' ? 1 : 0;
    value.coverage.complete = mode === 'failed-report';
  }
  if (['window-pass', 'observation-gap', 'gap-pass', 'missing-window'].includes(mode)) {
    value.rulesetVersion = '0.4.0'; value.scenario.kind = 'tabs';
    const observed = { observationWindowMs: 200, observationCount: 3, observationIntervalsMs: [100, 100], maxObservationGapMs: 100 };
    value.checks[0] = { ...value.checks[0], ruleId: 'T05', checkId: 'T05.forward.001.unchanged', observed };
    if (mode === 'observation-gap' || mode === 'gap-pass') {
      Object.assign(observed, { observationIntervalsMs: [50, 150], maxObservationGapMs: 150 });
    }
    if (mode === 'missing-window') value.checks[0].observed = {};
    if (mode === 'observation-gap') {
      value.checks[0].status = 'blocked'; value.checks[0].messageCode = 'OBSERVATION_GAP';
      value.outcome = 'blocked'; value.coverage.passed = 0; value.coverage.blocked = 1; value.coverage.complete = false;
    }
  }
  let body = Buffer.from(JSON.stringify(value));
  if (mode === 'bad-json') body = Buffer.from('{synthetic-private-payload-canary');
  if (mode === 'bad-utf8') body = Buffer.concat([body, Buffer.from([0xff])]);
  if (mode === 'large-body' || mode === 'large-path') body = Buffer.alloc(5 * 1024 * 1024 + 1, 32);
  if (mode === 'limit-body' || mode === 'limit-path') body = Buffer.concat([body, Buffer.alloc(5 * 1024 * 1024 - body.length, 32)]);
  const contentType = mode === 'mime' ? 'text/plain' : 'application/json';
  if (['path', 'large-path', 'limit-path'].includes(mode)) {
    const path = info.outputPath('fixture.json'); writeFileSync(path, body);
    await info.attach('journey-result.json', { path, contentType });
  } else await info.attach('journey-result.json', { body, contentType });
  if (mode === 'retry-incomplete' && info.retry === 0) throw new Error('synthetic incomplete retry');
  if (mode === 'duplicate') await info.attach('journey-result.json', { body, contentType });
});
if (mode === 'static-skip') test.skip('static skipped', async () => {});
