# Dialog consumers: native behavior and explicit contracts

These external examples use the published `keytrail@1.0.0`, with the exact UI
versions in `package-lock.json`. They exercise an application's Edit profile
journey, without changing a framework's focus trap. They are not framework
conformance tests or an accessibility certification.

```sh
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm test
node verify-report.mjs artifacts/results.json
npm run build
KEYTRAIL_RECIPE_PREVIEW=1 npm test
node verify-report.mjs artifacts/results.json
```

For an installed Chrome, set `KEYTRAIL_TEST_CHROME` to its executable. Open the
HTML evidence with `npx --no-install playwright show-report artifacts/html`.
`KEYTRAIL_RECIPE_REPORT` selects a separate JSON filename for each run.

## What the checks mean

Each consumer first runs an ordinary Playwright test: Tab to the opening
button, Enter, focus inside the visible dialog, Escape, focus returned to the
button. All nine native tests pass locally on macOS ARM / Chrome 157.

KeyTrail additionally checks the declared initial focus, role/name/modality,
forward and reverse focus order, dismissal and return target. Three consumers
pass that contract and reject an intentionally wrong return target. Six retain
a specific **failed** journey report. A passing test of an expected failure does
not turn its journey into a pass.

| Consumer | Published version | First KeyTrail result in this fixture |
| --- | --- | --- |
| Bootstrap | 5.3.9 | `D04.forward.003`, `FOCUS_MISMATCH`: observed `body` |
| CoreUI | 5.9.1 | `D04.forward.003`, `FOCUS_MISMATCH`: observed `body` |
| UIkit | 3.25.31 | `D04.forward.002`, `FOCUS_MISMATCH`: observed `body` |
| React Modal | 3.16.3 | Pass; wrong-return negative control fails |
| Vuetify | 4.3.3 | Pass; wrong-return negative control fails |
| Quasar | 2.35.4 | `D04.forward.002`, `FOCUS_MISMATCH`: observed `body` |
| Ant Design Vue | 4.2.6 | `D02.modal`, `MODAL_MISMATCH` |
| NG-ZORRO | 22.2.0 | `D02.name`, `NAME_MISSING` |
| Melt UI | 0.86.6 | Pass; wrong-return negative control fails |

The body observations occur at the tab boundary in these fixtures. They are a
compatibility observation, not proof of a permanent focus escape or an upstream
bug. Browser chrome and later focus recovery are outside this check. Ant Design
Vue's default modal does not satisfy the contract's `aria-modal` requirement;
NG-ZORRO's default visible title does not provide the accessible name expected
here. Those checks stop the journey; later checks are not claimed to pass.

The consumers preserve those defaults so the limitation remains visible.
Use `?library=bootstrap`, `coreui`, `uikit`, `react-modal`, `vuetify`, `quasar`,
`antvue`, `ng-zorro` or `melt` to inspect a fixture. The Vue/Angular/Svelte/React
setup is in separate small source modules. NG-ZORRO's CSS export is resolved
specifically to its published stylesheet, without adding a global `style`
resolution condition that could change other packages' imports.

## Value and limits

A short native test is enough when only opening, closing and focus return matter.
KeyTrail adds the reusable contract and attached JSON with the first failed
checkpoint; that tradeoff is useful only if an application needs those reports
across more journeys. These examples do not establish faster development,
rendering correctness, screen-reader behavior, every component option, other
browser engines, or adoption by any framework.

There are 21 tests: 9 native, 9 contracts/compatibility results, and 3 wrong-return
controls. The verifier requires one worker, one attempt, no skip/flaky/error,
3 passing journey reports and 9 failed reports (6 compatibility + 3 controls).
The original reports retain all checks and not-run states. No retries, observation
threshold changes or release qualification runs are introduced.
