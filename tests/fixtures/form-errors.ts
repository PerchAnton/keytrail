import type { Page } from '@playwright/test';
import type { FormErrorsContract } from '../../src/index.js';

export type FormOptions = {
  policy?: 'firstInvalid' | 'summary' | 'stay'; mode?: 'live' | 'resubmit';
  links?: boolean; via?: 'aria-describedby' | 'aria-errormessage'; defect?: string;
  external?: boolean; nativeLinks?: boolean; submitKey?: 'Enter' | 'Space'; values?: string[]; fieldType?: string;
};
export function formHtml(options: FormOptions = {}) {
  const config = { policy: 'firstInvalid', mode: 'live', via: 'aria-describedby', values: ['sample-one', 'sample-two'], ...options };
  const messages = [0, 1].map(i => `<p id="error-${i}" hidden>Enter a valid value ${i + 1}.</p>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Form journey fixture</title>
<button id="before">Before</button><section id="summary" tabindex="-1" hidden><h2>Check these fields</h2>
${[0, 1].map(i => `<a id="link-${i}" href="#field-${i}">Review field ${i + 1}</a>`).join('')}</section>
<form id="form" novalidate><p id="hint">Use synthetic data.</p>
${[0, 1].map(i => `<label for="field-${i}">Field ${i + 1}</label><input id="field-${i}" value="invalid" type="text">`).join('')}
${options.external ? '' : messages}<button id="submit" type="submit">Save</button></form>
${options.external ? messages : ''}<button id="after">After</button>
<script>
const cfg = ${JSON.stringify(config)}, form = document.querySelector('#form'), summary = document.querySelector('#summary');
const submit = document.querySelector('#submit'), field = i => document.querySelector('#field-' + i), message = i => document.querySelector('#error-' + i);
window.keytrailKeys = []; window.keytrailSubmits = 0;
document.addEventListener('keydown', e => { window.keytrailKeys.push(e.key); });
function clear(i) {
  if ((cfg.defect === 'not-cleared' && i === 0) || (cfg.defect === 'second-not-cleared' && i === 1)) return;
  if (cfg.defect === 'removed-message') message(i)?.remove(); else if (message(i)) message(i).hidden = true;
  if (cfg.defect !== 'stale-invalid') field(i).removeAttribute('aria-invalid');
  if (cfg.defect === 'reappeared-error' && i === 1) { message(0).hidden = false; field(0).setAttribute('aria-invalid', 'true'); }
}
function show() {
  summary.hidden = false;
  for (let i = 0; i < 2; i++) {
    message(i).hidden = false;
    field(i).setAttribute('aria-invalid', cfg.defect === 'no-invalid' && i === 0 ? 'false' : 'true');
    field(i).setAttribute(cfg.via, (cfg.via === 'aria-describedby' ? 'hint ' : '') + (cfg.defect === 'idref' && i === 0 ? 'error-1' : 'error-' + i));
  }
  if (cfg.defect === 'extra-message-idref') field(0).setAttribute(cfg.via, 'error-0 error-1 hint');
  if (cfg.defect === 'empty-text') message(0).textContent = '   ';
  if (cfg.defect === 'wrong-text') message(0).textContent = 'A different error';
  if (cfg.defect === 'hidden-text') message(0).innerHTML = '<span hidden>Enter a valid value 1.</span><span> </span>';
  if (cfg.defect === 'readonly') field(0).readOnly = true;
  if (cfg.defect === 'aria-disabled') field(0).setAttribute('aria-disabled', 'true');
  if (cfg.defect === 'unreachable-correction') field(0).tabIndex = -1;
  if (cfg.defect === 'wrong-focus') document.querySelector('#after').focus();
  else if (cfg.policy === 'firstInvalid') field(0).focus();
  else if (cfg.policy === 'summary') summary.focus();
}
form.addEventListener('submit', e => {
  e.preventDefault(); window.keytrailSubmits++;
  if (cfg.defect === 'navigation') { location.hash = 'navigated'; return; }
  if (cfg.defect === 'popup') { window.open('about:blank'); return; }
  if ([0, 1].every(i => field(i).value === cfg.values[i])) { [0, 1].forEach(clear); summary.hidden = true; return; }
  if (cfg.defect === 'delayed') setTimeout(show, 120); else show();
});
for (let i = 0; i < 2; i++) {
  if (!cfg.nativeLinks) document.querySelector('#link-' + i).addEventListener('click', e => {
    e.preventDefault(); if (cfg.defect === 'reload-link') { location.reload(); return; }
    field(cfg.defect === 'wrong-link' ? 1 - i : i).focus();
  });
  if (cfg.defect === 'unreachable-link') document.querySelector('#link-' + i).tabIndex = -1;
}
form.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    if (cfg.defect === 'select-drift') document.querySelector('#after').focus();
    if (cfg.defect === 'select-prevented') { e.preventDefault(); e.target.setSelectionRange(e.target.value.length, e.target.value.length); }
  }
});
form.addEventListener('input', e => {
  if (cfg.defect === 'value-transform') e.target.value = 'changed';
  if (cfg.defect === 'rerender') { const clone = e.target.cloneNode(); clone.value = e.target.value; e.target.replaceWith(clone); clone.focus(); }
});
form.addEventListener('focusout', e => {
  const i = [0, 1].find(i => field(i) === e.target);
  if (i !== undefined && cfg.mode === 'live' && field(i).value === cfg.values[i]) clear(i);
});
if (cfg.fieldType) {
  if (cfg.fieldType === 'textarea') { const t = document.createElement('textarea'); t.id = 'field-0'; t.value = 'invalid'; field(0).replaceWith(t); }
  else field(0).type = cfg.fieldType;
}
if (cfg.defect === 'no-novalidate') form.removeAttribute('novalidate');
if (cfg.defect === 'button-type') submit.type = 'button';
if (cfg.defect === 'outside-field') form.after(field(0));
if (cfg.defect === 'duplicate-id') { const copy = message(0).cloneNode(true); document.body.append(copy); }
</script></html>`;
}
export function formContract(page: Page, options: FormOptions = {}): FormErrorsContract {
  const target = (id: string) => ({ id, locator: page.locator('#' + id) });
  const form = target('form'), submit = target('submit'), fields = [0, 1].map(i => target('field-' + i));
  const policy = options.policy ?? 'firstInvalid';
  return { id: 'profile-errors', form, submit, submitKey: options.submitKey ?? 'Enter',
    errors: fields.map((field, i) => ({ field, message: target('error-' + i), via: options.via ?? 'aria-describedby',
      expectedText: `Enter a valid value ${i + 1}.` })),
    focusAfterInvalid: { policy, target: policy === 'firstInvalid' ? fields[0]! : policy === 'summary' ? target('summary') : submit },
    ...(options.links ? { summaryLinks: fields.map((field, i) => ({ link: target('link-' + i), field })) } : {}),
    correction: fields.map((field, i) => ({ field, value: options.values?.[i] ?? ['sample-one', 'sample-two'][i]! })),
    validateCorrection: options.mode ?? 'live',
  };
}
