import type { JourneyResult } from '../contracts/types.js';
import { validJourneyResult } from './validate.js';

function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  const copy = Object.create(null) as Pick<T, K>;
  for (const key of keys) if (Object.hasOwn(value, key)) copy[key] = value[key];
  return copy;
}
const observationKeys = ['focus', 'visible', 'role', 'hasAccessibleName', 'modal', 'inside',
  'count', 'maxTabs', 'matched', 'selected', 'selectedCount', 'visibleCount', 'roving',
  'orientation', 'observationWindowMs', 'observationCount', 'observationIntervalsMs', 'maxObservationGapMs', 'invalid', 'editable'] as const;
function observation(value: JourneyResult['checks'][number]['observed']) {
  const safe = pick(value, observationKeys);
  if (safe.observationIntervalsMs !== undefined) safe.observationIntervalsMs = [...safe.observationIntervalsMs];
  return safe;
}

/** Copy only the report allowlist. Never serialize contracts or arbitrary error objects. */
export function serializeJourneyResult(result: JourneyResult): Buffer {
  try {
    const safe = {
      ...pick(result, ['schemaVersion', 'rulesetVersion', 'packageVersion', 'outcome']),
      run: pick(result.run, ['runId', 'testRef', 'attempt', 'startedAt', 'durationMs', 'nodeVersion', 'playwrightVersion', 'browserVersion']),
      scenario: pick(result.scenario, ['id', 'kind', 'contractVersion']),
      config: pick(result.config, ['maxTabs', 'timeoutMs', 'scenarioTimeoutMs', 'observationWindowMs', 'inputMode']),
      coverage: pick(result.coverage, ['planned', 'passed', 'failed', 'blocked', 'notRun', 'complete', 'entryEvidence']),
      checks: result.checks.map(check => ({
        ...pick(check, ['checkId', 'ruleId', 'stepId', 'status', 'messageCode', 'basis', 'blockedBy', 'guidanceUrl']),
        expected: observation(check.expected), observed: observation(check.observed),
      })),
      steps: result.steps.map(step => pick(step, ['stepId', 'actionKind', 'key', 'targetId',
        'beforeFocus', 'afterFocus', 'elapsedMs', 'observationWindowMs'])),
      limitations: [...result.limitations],
    };
    if (validJourneyResult(safe)) return Buffer.from(JSON.stringify(safe));
  } catch { /* Do not expose values or error messages from malformed objects. */ }
  throw new Error('REPORT_WRITE_FAILED');
}
