# Verification of the first dialog checkpoint

Recorded 28 October 2026 on macOS arm64, Node 24.22.1, Playwright 1.64.1,
Chromium 156.0.8078.4. These are results from synthetic fixtures, not customer data.

| Check | Result |
| --- | --- |
| Unit tests | 7 passed: validation, snapshot isolation, traversal plan and outcome/coverage |
| Chromium integration tests | 33 passed with 4 workers and 33 passed with 1 worker |
| Observation comparison | All check IDs, statuses, message codes, dependencies and coverage agree across the two runs |
| Required correct dialog variants | Ordinary cycle, single stop, static heading, alternate return Target |
| Required defects | Wrong initial focus, escape outside, broken reverse cycle, Escape ignored, lost return focus, missing accessible name |
| Further regressions | Delayed/replaced nodes, observed escape followed by return, limits, unsupported contexts, safe own reports and attachment failure |
| Package consumers | Fresh offline install; ESM/CJS imports and declarations; two Chromium examples from the installed archive |

The six defect tests pass because they observe the expected failures. They do not count
as accessible components. [Raw outcomes and source hashes](evidence/dialog.json) record
the difference between the test outcome and the journey outcome for every fixture.

A regression was reproduced during development: an observed focus escape could be
hidden by a later return during polling. The regression now requires D05 to fail and
checks that Escape is not sent to an external component. No upstream bug is claimed.

Reproduce the worker comparison:

```sh
pnpm build
pnpm test:unit
pnpm exec playwright test --workers=4
cp artifacts/browser-results.json artifacts/browser-results-workers4.json
pnpm exec playwright test --workers=1
node scripts/record-evidence.mjs
pnpm test:package
```

The package command writes its archive hash to `artifacts/package-verification.json`.
That hash is kept outside the packed docs to avoid a self-referential archive hash.
The CI badge links to current Linux/macOS results; this page records the initial local
run. The full 100-run repeatability criterion and equivalent native performance
benchmark have **not** been completed. The full tabs/forms/CI-guard milestone is pending.
