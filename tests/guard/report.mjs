import { createHash, randomUUID } from 'node:crypto';

// Synthetic wire-format fixture. Real browser reports are checked in the package consumer.
export function report(testId = 'synthetic', attempt = 0) {
  return {
    schemaVersion: '1', rulesetVersion: '0.3.0', packageVersion: '0.1.0-alpha.4',
    run: { runId: randomUUID(), testRef: createHash('sha256').update(testId).digest('hex'), attempt,
      startedAt: new Date().toISOString(), durationMs: 1, nodeVersion: process.versions.node,
      playwrightVersion: '1.64.1', browserVersion: 'synthetic' },
    scenario: { id: 'fixture', kind: 'dialog', contractVersion: '1' },
    config: { maxTabs: 25, timeoutMs: 2000, scenarioTimeoutMs: 30000, observationWindowMs: 200 },
    outcome: 'passed',
    coverage: { planned: 1, passed: 1, failed: 0, blocked: 0, notRun: 0, complete: true, entryEvidence: 'tab' },
    checks: [{ checkId: 'D01.entry', ruleId: 'D01', stepId: 'step-001', status: 'pass',
      messageCode: 'OK', expected: { focus: 'trigger' }, observed: { focus: 'trigger' }, basis: 'contract' }],
    steps: [{ stepId: 'step-001', actionKind: 'press', key: 'Tab', targetId: 'trigger',
      beforeFocus: 'body', afterFocus: 'trigger', elapsedMs: 1, observationWindowMs: 200 }], limitations: [],
  };
}
