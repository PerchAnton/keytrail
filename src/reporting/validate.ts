import type { JourneyResult } from '../contracts/types.js';
import validateSchema from '../../artifacts/generated/schema-validator.cjs';
import { coverage, outcome } from './result.js';
import { MAX_OBSERVATION_GAP_MS } from '../engine/observation-window.js';

/** JSON shape plus relationships that JSON Schema cannot express. */
export function validJourneyResult(value: unknown): value is JourneyResult {
  if (!validateSchema(value)) return false;
  const result = value as JourneyResult;
  const actual = coverage(result.checks, result.coverage.entryEvidence);
  for (const key of ['planned', 'passed', 'failed', 'blocked', 'notRun', 'complete'] as const) {
    if (result.coverage[key] !== actual[key]) return false;
  }
  if (result.outcome !== outcome(actual)) return false;
  if (result.outcome === 'passed' && actual.entryEvidence === 'unreached') return false;
  const checks = new Map(result.checks.map(check => [check.checkId, check]));
  const steps = new Set(result.steps.map(step => step.stepId));
  if (checks.size !== result.checks.length || steps.size !== result.steps.length) return false;
  const family = { dialog: 'D', tabs: 'T', formErrors: 'F' }[result.scenario.kind];
  for (const check of result.checks) {
    if (check.stepId !== null && !steps.has(check.stepId)) return false;
    if (check.checkId !== 'E_CONFIG' && !check.checkId.startsWith(`${check.ruleId}.`)) return false;
    if (check.ruleId !== 'E_CONFIG' && !check.ruleId.startsWith(family)) return false;
    if (check.ruleId === 'E_CONFIG' && (check.status !== 'blocked' || check.messageCode !== 'CONFIG_INVALID')) return false;
    if ((check.status === 'pass') !== (check.messageCode === 'OK')) return false;
    if ((check.status === 'not_run') !== (check.messageCode === 'NOT_RUN')) return false;
    const o = check.observed;
    if (o.observationIntervalsMs !== undefined) {
      const intervals = o.observationIntervalsMs;
      const duration = intervals.reduce((sum, interval) => sum + interval, 0);
      const max = intervals.reduce((value, interval) => Math.max(value, interval), 0);
      if (o.observationCount !== intervals.length + 1 || o.maxObservationGapMs !== max ||
          o.observationWindowMs === undefined || Math.abs(o.observationWindowMs - duration) > 0.001) return false;
      if (check.status === 'pass' && (intervals.length === 0 || max > MAX_OBSERVATION_GAP_MS ||
          duration < result.config.observationWindowMs)) return false;
      if (check.messageCode === 'OBSERVATION_GAP' && (check.status !== 'blocked' || max <= MAX_OBSERVATION_GAP_MS)) return false;
    } else if (check.messageCode === 'OBSERVATION_GAP' || o.observationCount !== undefined || o.maxObservationGapMs !== undefined) return false;
    if (result.rulesetVersion === '0.4.0' && check.ruleId === 'T05' && check.checkId.endsWith('.unchanged') &&
        check.status === 'pass' && o.observationIntervalsMs === undefined) return false;
    if (check.status === 'not_run') {
      const cause = check.blockedBy && checks.get(check.blockedBy);
      if (check.blockedBy !== 'E_ABORTED' && (!cause || !['fail', 'blocked'].includes(cause.status))) return false;
    } else if (check.blockedBy !== undefined) return false;
  }
  return true;
}
