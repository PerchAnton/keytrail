import { test, expect } from '@playwright/test';
import { assertFormErrorsJourney, JourneyAssertionError } from 'keytrail';
import { readFileSync } from 'node:fs';

for (const broken of [false, true]) test(broken ? 'detects an error left visible after correction' : 'passes email error recovery', async ({ page }, info) => {
  const html = readFileSync(new URL('./form-errors.html', import.meta.url), 'utf8');
  await page.setContent(broken ? html.replace('error.hidden = true;', 'error.hidden = false;') : html);
  const email = { id: 'email', locator: page.getByLabel('Email', { exact: true }) };
  const run = () => assertFormErrorsJourney(page, info, {
    id: 'contact-errors', form: { id: 'contact', locator: page.locator('#contact') },
    submit: { id: 'save', locator: page.getByRole('button', { name: 'Save', exact: true }) }, submitKey: 'Enter',
    errors: [{ field: email, message: { id: 'email-error', locator: page.locator('#email-error') },
      via: 'aria-describedby', expectedText: 'Enter a valid email address.' }],
    focusAfterInvalid: { policy: 'firstInvalid', target: email },
    correction: [{ field: email, value: 'reader@example.test' }], validateCorrection: 'live',
  });
  if (!broken) { expect((await run()).outcome).toBe('passed'); return; }
  // Catch the expected defect only in this teaching example; let application tests fail.
  try { await run(); throw new Error('Broken fixture unexpectedly passed'); }
  catch (error) {
    expect(error).toBeInstanceOf(JourneyAssertionError);
    const result = (error as JourneyAssertionError).result;
    expect((error as JourneyAssertionError).code).toBe('ERROR_NOT_CLEARED');
    expect(result.checks.find(check => check.status === 'fail')?.checkId).toBe('F06.clear.001');
    expect(JSON.stringify(result)).not.toContain('reader@example.test');
  }
});
