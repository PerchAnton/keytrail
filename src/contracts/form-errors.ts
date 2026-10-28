import type { AppliedConfig, FormErrorsContract, Target } from './types.js';
import { object, snapshotTargets, validateCommon } from './common.js';

export type ValidatedForm = { contract: FormErrorsContract; config: AppliedConfig; targets: Target[] };
export function validateFormErrors(value: unknown): ValidatedForm | null {
  const common = validateCommon(value);
  if (!common || !object(value) || !Array.isArray(value.errors) || value.errors.length < 1 || value.errors.length > 20 ||
      !Array.isArray(value.correction) || value.correction.length !== value.errors.length ||
      !['Enter', 'Space'].includes(value.submitKey as string) ||
      !['live', 'resubmit'].includes(value.validateCorrection as string) || !object(value.focusAfterInvalid)) return null;
  if (value.summaryLinks !== undefined && (!Array.isArray(value.summaryLinks) || value.summaryLinks.length > 100)) return null;
  const links = (value.summaryLinks ?? []) as unknown[];
  if (![...value.errors, ...value.correction, ...links].every(object)) return null;
  const errors = value.errors as Record<string, unknown>[], correction = value.correction as Record<string, unknown>[];
  const summaryLinks = links as Record<string, unknown>[];
  const fields = errors.map(e => e.field), messages = errors.map(e => e.message);
  if (new Set(fields).size !== fields.length || value.form === value.submit ||
      [...fields, ...messages].some(t => t === value.form || t === value.submit) || fields.some(t => messages.includes(t))) return null;
  for (const error of errors) {
    if (!['aria-describedby', 'aria-errormessage'].includes(error.via as string)) return null;
    const text = error.expectedText;
    if (typeof text === 'string' ? !text.trim() : !(text instanceof RegExp) || text.global || text.sticky) return null;
  }
  if (new Set(correction.map(c => c.field)).size !== fields.length || correction.some(c =>
    !fields.includes(c.field) || typeof c.value !== 'string' || [...c.value].length > 256)) return null;
  if (new Set(summaryLinks.map(l => l.link)).size !== summaryLinks.length ||
      summaryLinks.some(l => !fields.includes(l.field))) return null;
  const focus = value.focusAfterInvalid;
  if (!['firstInvalid', 'summary', 'stay'].includes(focus.policy as string) ||
      (focus.policy === 'firstInvalid' && focus.target !== fields[0]) ||
      (focus.policy === 'stay' && focus.target !== value.submit)) return null;
  const copies = snapshotTargets([value.form, value.submit, ...fields, ...messages, focus.target,
    ...summaryLinks.flatMap(l => [l.link, l.field]), ...correction.map(c => c.field)]);
  if (!copies) return null;
  const copy = (t: unknown) => copies.get(t as Target)!;
  const contract: FormErrorsContract = Object.freeze({
    id: value.id as string, contractVersion: (value.contractVersion as string | undefined) ?? '1',
    form: copy(value.form), submit: copy(value.submit), submitKey: value.submitKey as 'Enter' | 'Space',
    errors: Object.freeze(errors.map(e => Object.freeze({ field: copy(e.field), message: copy(e.message),
      via: e.via as 'aria-describedby' | 'aria-errormessage', expectedText: typeof e.expectedText === 'string' ?
        e.expectedText : new RegExp((e.expectedText as RegExp).source, (e.expectedText as RegExp).flags) }))),
    focusAfterInvalid: Object.freeze({ policy: focus.policy as 'firstInvalid' | 'summary' | 'stay', target: copy(focus.target) }),
    summaryLinks: Object.freeze(summaryLinks.map(l => Object.freeze({ link: copy(l.link), field: copy(l.field) }))),
    correction: Object.freeze(correction.map(c => Object.freeze({ field: copy(c.field), value: c.value as string }))),
    validateCorrection: value.validateCorrection as 'live' | 'resubmit',
  });
  return { contract, config: common.config, targets: [...copies.values()] };
}
