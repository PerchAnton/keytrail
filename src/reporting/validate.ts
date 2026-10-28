import type { JourneyResult } from '../contracts/types.js';
import validateSchema from '../../artifacts/generated/schema-validator.cjs';
import { coverage, outcome } from './result.js';

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
    if (check.status === 'not_run') {
      const cause = check.blockedBy && checks.get(check.blockedBy);
      if (check.blockedBy !== 'E_ABORTED' && (!cause || !['fail', 'blocked'].includes(cause.status))) return false;
    } else if (check.blockedBy !== undefined) return false;
  }
  return true;
}
