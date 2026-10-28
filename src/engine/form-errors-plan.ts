import type { CheckResult, FormErrorsContract } from '../contracts/types.js';

export const ordinal = (index: number) => String(index + 1).padStart(3, '0');
export function planFormErrors(contract: FormErrorsContract): CheckResult[] {
  const checks: CheckResult[] = [];
  const add = (checkId: string, expected: CheckResult['expected']) => checks.push({
    checkId, ruleId: checkId.slice(0, 3), expected, observed: {}, stepId: null,
    status: 'not_run', messageCode: 'NOT_RUN', basis: 'contract',
  });
  add('F01.structure', { matched: true });
  add('F01.entry', { focus: contract.submit.id });
  add('F01.submit', { matched: true });
  contract.errors.forEach((_, i) => add(`F02.message.${ordinal(i)}`, { visible: true, matched: true }));
  contract.errors.forEach((_, i) => {
    add(`F03.field.${ordinal(i)}.invalid`, { invalid: true });
    add(`F03.field.${ordinal(i)}.idref`, { matched: true });
  });
  add('F04.focus', { focus: contract.focusAfterInvalid.target.id });
  contract.summaryLinks?.forEach((link, i) => {
    add(`F05.link.${ordinal(i)}.entry`, { focus: link.link.id });
    add(`F05.link.${ordinal(i)}.focus`, { focus: link.field.id });
  });
  contract.correction.forEach((item, i) => {
    add(`F06.field.${ordinal(i)}.entry`, { focus: item.field.id });
    add(`F06.field.${ordinal(i)}.value`, { editable: true, matched: true });
    if (contract.validateCorrection === 'live') add(`F06.field.${ordinal(i)}.blur`, { matched: true });
  });
  if (contract.validateCorrection === 'resubmit') {
    add('F06.resubmit.entry', { focus: contract.submit.id }); add('F06.resubmit', { matched: true });
  }
  contract.errors.forEach((_, i) => add(`F06.clear.${ordinal(i)}`, { visible: false, invalid: false }));
  return checks;
}
