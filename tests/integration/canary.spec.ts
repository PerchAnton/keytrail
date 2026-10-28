import { test, expect } from '@playwright/test';
import { assertDialogJourney, assertTabsJourney, assertFormErrorsJourney, JourneyAssertionError, type JourneyResult } from '../../src/index.js';
import { dialogHtml, dialogContract } from '../fixtures/dialog.js';
import { tabsHtml, tabsContract } from '../fixtures/tabs.js';
import { formHtml, formContract } from '../fixtures/form-errors.js';

const canaries = {
  input: 'kt-input-8e02f4', message: 'kt-message-a594bd', name: 'kt-name-cba965',
  url: 'kt-url-743d2e', exception: 'kt-exception-3bb319',
};
for (const kind of ['dialog', 'tabs', 'formErrors'] as const) for (const rawError of [false, true]) {
  test(`canary isolation ${kind} ${rawError ? 'raw error' : 'successful input'}`, async ({ page }, info) => {
    const values = [canaries.input, 'synthetic-second-value'];
    let html = kind === 'dialog' ? dialogHtml() : kind === 'tabs' ? tabsHtml({ activation: 'manual' }) : formHtml({ values });
    if (kind === 'formErrors') html = html.replace('Enter a valid value 1.', canaries.message);
    const url = `https://keytrail.test/${canaries.url}`;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(url);
    await page.evaluate(({ kind, canaries }) => {
      const named = document.querySelector(kind === 'dialog' ? '#title' : kind === 'tabs' ? '#tabs' : '#submit')!;
      if (kind === 'dialog') named.textContent = canaries.name;
      else named.setAttribute('aria-label', canaries.name);
      if (kind === 'dialog') (document.querySelector('#name') as HTMLInputElement).value = canaries.input;
      if (kind === 'tabs') {
        const input = document.createElement('input'); input.value = canaries.input; input.tabIndex = -1; document.body.append(input);
      }
      if (kind !== 'formErrors') { const p = document.createElement('p'); p.hidden = true; p.textContent = canaries.message; document.body.append(p); }
      (window as any).keytrailInputEvents = 0;
      document.addEventListener('input', () => (window as any).keytrailInputEvents++);
    }, { kind, canaries });
    const press = page.keyboard.press.bind(page.keyboard);
    if (rawError) page.keyboard.press = async () => { throw new Error(canaries.exception); };
    const stdout = process.stdout.write, stderr = process.stderr.write;
    const captured: string[] = [];
    const capture = (original: typeof stdout, stream: NodeJS.WriteStream) => function (this: unknown, chunk: any, ...args: any[]) {
      captured.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
      return (original as any).call(stream, chunk, ...args);
    } as typeof stdout;
    let result: JourneyResult | undefined, message = '';
    process.stdout.write = capture(stdout, process.stdout); process.stderr.write = capture(stderr, process.stderr);
    try {
      if (kind === 'dialog') result = await assertDialogJourney(page, info, { ...dialogContract(page), unexpected: { value: canaries.input } } as any);
      else if (kind === 'tabs') result = await assertTabsJourney(page, info, tabsContract(page, { activation: 'manual' }));
      else {
        const form = formContract(page, { values });
        result = await assertFormErrorsJourney(page, info, { ...form,
          errors: form.errors.map((e, i) => i ? e : { ...e, expectedText: canaries.message }) });
      }
    } catch (error) {
      expect(error).toBeInstanceOf(JourneyAssertionError);
      const failure = error as JourneyAssertionError; result = failure.result; message = failure.message;
      expect(failure.code).toBe('BROWSER_ERROR');
    } finally {
      process.stdout.write = stdout; process.stderr.write = stderr; page.keyboard.press = press;
    }
    expect(result!.outcome).toBe(rawError ? 'blocked' : 'passed');
    const reports = info.attachments.filter(a => a.name === 'journey-result.json');
    expect(reports).toHaveLength(1); expect(JSON.parse(reports[0]!.body!.toString())).toEqual(result);
    const ownOutput = JSON.stringify(result) + message + reports[0]!.body!.toString() + captured.join('');
    for (const canary of Object.values(canaries)) expect(ownOutput).not.toContain(canary);
    if (kind === 'formErrors' && !rawError) expect(await page.locator('#field-0').inputValue()).toBe(canaries.input);
    const readEvents = () => page.evaluate(() => ({ keys: (window as any).keytrailKeys.length, inputs: (window as any).keytrailInputEvents }));
    const after = await readEvents(); await page.waitForTimeout(100); expect(await readEvents()).toEqual(after);
  });
}
