# KeyTrail

**Check a dialog's keyboard journey in your existing Playwright tests.** Declare the
expected focus order; KeyTrail presses keys, checks the result and attaches a report
showing the first mismatch and the observations that could not run.

[![CI](https://github.com/PerchAnton/keytrail/actions/workflows/ci.yml/badge.svg)](https://github.com/PerchAnton/keytrail/actions/workflows/ci.yml)
[Русский](README.ru.md) · [API](docs/api.md) · [Rules and errors](docs/rules.md) · [Limits](docs/limits.md) · [Roadmap](docs/roadmap.md)

**Status: first working prototype, `0.1.0-alpha.1` source/package candidate.** No npm
publication or GitHub release yet. This milestone implements custom ARIA dialogs.
Tabs, forms, and a CI completeness reporter are planned for later milestones.

```text
Tab to trigger → Enter → initial focus → Tab cycle → Shift+Tab cycle → Escape
                                                                         ↓
                                                           focus returns to trigger
```

If the dialog closes but leaves focus on the page body:

```text
D07 FOCUS_MISMATCH expected=open-profile observed=body
```

The corrected component passes the same contract. The runnable example includes both
versions; its intentionally broken fixture is our teaching example, not an upstream bug.

## Try the packaged example

Node.js 24 and pnpm 11.25.0 are used for development. The tested Playwright peer version
is **1.64.1**, with its Chromium **156.0.8078.4**. [Compatibility](docs/compatibility.md).

```sh
git clone https://github.com/PerchAnton/keytrail.git
cd keytrail
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium
pnpm build
pnpm test:package
```

On Linux, install Chromium's system dependencies with
`pnpm exec playwright install --with-deps chromium` when needed.
The package check packs the actual archive, installs it into a fresh offline consumer,
checks ESM/CJS imports and types, then runs the working and broken browser examples.
It leaves `artifacts/keytrail-0.1.0-alpha.1.tgz` and a verification record.

Install that archive into an existing Playwright project:

```sh
npm install --save-dev /absolute/path/to/keytrail-0.1.0-alpha.1.tgz @playwright/test@1.64.1
```

## Write a contract

```ts
import { test } from '@playwright/test';
import { assertDialogJourney } from 'keytrail';

test('profile dialog', async ({ page }, testInfo) => {
  await page.goto('/profile'); // Your application and prepared synthetic state.
  const trigger = { id: 'open-profile', locator: page.getByRole('button', { name: 'Edit profile' }) };
  const name = { id: 'display-name', locator: page.getByLabel('Display name') };
  const close = { id: 'close-profile', locator: page.getByRole('button', { name: 'Close' }) };

  await assertDialogJourney(page, testInfo, {
    id: 'profile-dialog', trigger,
    dialog: { id: 'profile', locator: page.getByRole('dialog') },
    openKey: 'Enter', initialFocus: name, tabOrder: [name, close],
    closeKey: 'Escape', returnFocus: trigger,
  });
});
```

Use one journey per test, allow time for setup and reporting (the example uses 45 s),
and let `JourneyAssertionError` fail application tests. Do not catch and ignore it.
The [standalone example](examples/vanilla) provides the actual HTML and configuration;
`/profile` above is an application route, not a service supplied by this package.

## What the result means

| Status | Meaning |
| --- | --- |
| `pass` | The declared expectation was observed. |
| `fail` | An expectation did not match, such as the return focus. |
| `blocked` | A limit or unsupported/ambiguous context prevented a reliable check. |
| `not_run` | A planned observation was not attempted after an earlier interruption. |

`journey-result.json` is attached to Playwright's report. Every planned observation
remains in the result. A failure takes precedence over blocking; `coverage.complete`
still remains false if any checks are blocked or not run. Counts refer to individual
observations, not broad accessibility rules. [JSON schema](schema/journey-result.v1.json).

## When to use it

Evaluate KeyTrail when several dialogs need the same declared focus-cycle checks and
consistent diagnostics. Keep ordinary Playwright assertions when a small native test
is clearer or your component needs behavior outside the supported contract.

This is a behavioral test helper. Passing does not establish WCAG conformance,
screen-reader behavior, pointer blocking or complete accessibility. It does not
replace axe-core, manual testing or your component tests. It has no dependency on
our separate interaction-check, edit-session or RefMint projects.

## Development and evidence

```sh
pnpm check
pnpm exec playwright test --workers=1
pnpm exec playwright show-report
```

Tests cover the specified correct/defective dialogs, detached and replaced nodes,
unsupported contexts, bounded entry, scenario deadlines and safe own reports.
The [verification record](docs/verification.md) separates completed checks from the
full 0.1 acceptance criteria. Performance improvement and real-world adoption have
not been established. The 20% overhead target is a future acceptance target, not a result.

Original code, rules and examples are licensed under [Apache-2.0](LICENSE).
