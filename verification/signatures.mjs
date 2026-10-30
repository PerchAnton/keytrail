import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validJourneyResult } from '../artifacts/unit/validate.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const engineCases = new Set([
  'an early resolution error awaits slower sibling reads before clearing stored nodes',
  'a focus observation cannot combine two different instants',
  'replacement during observation is re-resolved and stored nodes are cleared',
  'a rejected main observation preserves its context diagnosis and releases handles',
  'a rejected iframe observation preserves its context diagnosis and releases handles',
  'interaction observations re-resolve replaced tabs without inventing metadata',
  'interaction observations detect an added tab with fallback role tokens',
  'live locator bindings change even when the previous element remains connected',
  'an absent foreign target cannot reuse a main-document binding',
]);
/** Normalize only UUID/time and measured windows; keep semantic observations and actions. */
export function inspectReport(report, workers, seenRunIds = new Set(), environment) {
  assert.equal(report.config.workers, workers, 'WORKER_COUNT');
  assert.deepEqual(report.errors, [], 'RUNNER_ERRORS');
  assert.equal(report.stats.unexpected + report.stats.flaky + report.stats.skipped, 0, 'UNSUCCESSFUL_RUN');
  assert(report.stats.expected > 0, 'EMPTY_SUITE');
  const cases = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) {
      assert.equal(test.expectedStatus, 'passed', 'EXPECTED_FAILURE');
      assert.equal(test.results.length, 1, 'RETRY');
      assert.equal(test.results[0].status, 'passed', 'TEST_STATUS');
      assert.equal(test.results[0].retry, 0, 'RETRY');
      const attachments = test.results[0].attachments.filter(a => a.name === 'journey-result.json');
      if (spec.file.endsWith('/observations.spec.ts') || spec.file === 'observations.spec.ts') {
        assert(engineCases.has(spec.title), 'UNRECOGNIZED_ENGINE_CASE');
        assert.equal(attachments.length, 0, 'ENGINE_ATTACHMENT');
        cases.push({ id: spec.id, file: spec.file, title: spec.title, kind: 'engine-observation' });
        continue;
      }
      assert.equal(attachments.length, 1, 'ATTACHMENT_COUNT');
      assert.equal(attachments[0].contentType, 'application/json', 'ATTACHMENT_MIME');
      assert.equal(typeof attachments[0].body, 'string', 'ATTACHMENT_BODY');
      const bytes = Buffer.from(attachments[0].body, 'base64');
      assert(bytes.length <= 5 * 1024 * 1024, 'ATTACHMENT_SIZE');
      const journey = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      assert(validJourneyResult(journey), 'REPORT_SCHEMA_OR_RELATIONSHIPS');
      assert.equal(journey.run.testRef, createHash('sha256').update(spec.id).digest('hex'), 'MIXED_TEST_ATTACHMENT');
      assert.equal(journey.run.attempt, 0, 'MIXED_ATTEMPT');
      if (environment) {
        assert.equal(journey.run.browserVersion, environment.chromium, 'BROWSER_CHANGED');
        assert.equal(journey.run.nodeVersion, environment.node, 'NODE_CHANGED');
        assert.equal(journey.run.playwrightVersion, environment.playwright, 'PLAYWRIGHT_CHANGED');
      }
      assert(!seenRunIds.has(journey.run.runId), 'REUSED_RUN_ID'); seenRunIds.add(journey.run.runId);
      const checks = journey.checks.map(check => {
        const observed = { ...check.observed }; delete observed.observationWindowMs; delete observed.observationCount; delete observed.observationIntervalsMs; delete observed.maxObservationGapMs;
        return { ...check, observed };
      });
      // Entry loops and budget boundaries can stop after a different number of valid
      // actions; the assertion suite verifies their bounds. Capture the action trace
      // separately, but require exact stable statuses/codes/dependencies in every round.
      cases.push({ id: spec.id, file: spec.file, title: spec.title, kind: journey.scenario.kind,
        scenario: journey.scenario, config: journey.config, outcome: journey.outcome, coverage: journey.coverage,
        checks: checks.map(({ stepId, ...check }) => check),
        actionTrace: journey.steps.map(({ elapsedMs, observationWindowMs, ...step }) => step),
        chromium: journey.run.browserVersion });
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites) walk(suite);
  cases.sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(cases.length, report.stats.expected, 'CASE_COUNT');
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length, 'DUPLICATE_TEST_ID');
  return cases;
}
export function semanticSignatures(cases) {
  return cases.map(({ actionTrace, chromium, ...value }) => value);
}
