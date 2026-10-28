import type { CheckResult, JourneyResult, MessageCode } from '../contracts/types.js';

export function coverage(checks: CheckResult[], entryEvidence: JourneyResult['coverage']['entryEvidence']): JourneyResult['coverage'] {
  const count = (status: CheckResult['status']) => checks.filter(c => c.status === status).length;
  const blocked = count('blocked'), notRun = count('not_run');
  return { planned: checks.length, passed: count('pass'), failed: count('fail'), blocked, notRun,
    complete: blocked === 0 && notRun === 0, entryEvidence };
}
export function outcome(value: JourneyResult['coverage']): JourneyResult['outcome'] {
  return value.failed ? 'failed' : !value.complete || !value.planned ? 'blocked' : 'passed';
}
export class JourneyAssertionError extends Error {
  readonly code: MessageCode;
  readonly result: JourneyResult;
  constructor(code: MessageCode, result: JourneyResult) {
    const first = result.checks.find(c => c.status === 'fail' || c.status === 'blocked');
    const focus = first?.expected.focus ? ` expected=${first.expected.focus} observed=${first.observed.focus ?? 'unknown'}` : '';
    super(`${first?.ruleId ?? 'E_REPORT'} ${code}${focus}`);
    this.name = 'JourneyAssertionError';
    this.code = code;
    this.result = result;
  }
}
