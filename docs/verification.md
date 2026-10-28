# Verification of dialogs and tabs

Recorded 28 October 2026 on macOS arm64, Node 24.22.1, Playwright 1.64.1,
Chromium 156.0.8078.4. These are results from synthetic fixtures, not customer data.

| Check | Result |
| --- | --- |
| TypeScript | Strict checks for library source, integration tests and Playwright configuration |
| Unit tests | 14 passed: validation, snapshot isolation, traversal plan and outcome/coverage |
| Chromium integration tests | 86 passed with 4 workers and 86 passed with 1 worker |
| Observation comparison | All check IDs, statuses, message codes, dependencies and coverage agree across the two runs |
| Required correct dialog variants | Ordinary cycle, single stop, static heading, alternate return Target |
| Required defects | Wrong initial focus, escape outside, broken reverse cycle, Escape ignored, lost return focus, missing accessible name |
| Further regressions | Coherent focus snapshots, replacement during observation, fallback roles, reserved-looking IDs, unsupported return focus, limits, safe reports and attachment failure |
| Tabs cases | Horizontal/vertical automatic, manual Enter/Space, Home/End restoration, delayed activation and replaced nodes |
| Tabs defects and boundaries | Wrong arrow, missing wrap, premature/manual activation, focus drift, selected/visible counts, IDREF, roving, exit, unsupported modes, budgets and safe reports |
| Package consumers | Fresh offline install; ESM/CJS imports and declarations; four Chromium examples from the installed archive |

Defect tests pass because they observe the expected failures. They do not count
as accessible components. [Raw outcomes and source hashes](evidence/journeys.json) record
the difference between the test outcome and the journey outcome for every fixture.
Two engine observation tests exercise focus consistency and temporary-handle disposal
directly, without a journey result; they are identified separately in the raw record.

A regression was reproduced during development: an observed focus escape could be
hidden by a later return during polling. The regression now requires D05 to fail and
checks that Escape is not sent to an external component. No upstream bug is claimed.

The next audit reproduced five further failures against the original driver:

- A sequential focus read could report two declared targets as focused at once.
- A valid target ID `unsupported` could incorrectly block a journey.
- A declared shadow host could mask focus inside an unsupported context.
- A declared iframe could mask focus inside that frame.
- A nested dialog with `role="dialog region"` could evade the layer check.

Focus identity and containment are now captured together. Context checks use separate
flags, and layer detection uses Playwright's role resolution. Regressions also verify
that `role="region dialog"` and an unrelated hidden shadow dialog do not cause false
blocking. Temporary handles are disposed after each observation, including retries.

Reproduce the worker comparison:

```sh
pnpm build
pnpm test:types
pnpm test:unit
pnpm exec playwright test --workers=4
cp artifacts/browser-results.json artifacts/browser-results-workers4.json
pnpm exec playwright test --workers=1
node scripts/record-evidence.mjs
```

The focused repeatability run executes eight of these tests 100 times each with one
worker and no retries. [Its record](evidence/repeatability.json) includes per-case
counts and source hashes. Reproduce it after the worker comparison:

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/repeatability-results.json \
  pnpm exec playwright test \
  --grep 'passes ordinary|passes rerender|two different instants|replacement during observation|named unsupported|cannot mask|fallback tokens' \
  --repeat-each=100 --workers=1 --reporter=json
node scripts/record-repeatability.mjs
```

The tabs repeatability run covers eight cases 20 times with four workers: the four
required modes, manual Home/End, immediate/delayed premature activation and focus drift.
[Its record](evidence/tabs-repeatability.json) is separate from the sequential focus run.

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/tabs-repeatability-results.json \
  pnpm exec playwright test tabs.spec.ts \
  --grep 'tabs pass (horizontal automatic|vertical automatic|manual Enter|manual Space|manual Home End)$|tabs detect (premature|late-premature|focus-drift)$' \
  --repeat-each=20 --workers=4 --reporter=json
node scripts/record-repeatability.mjs tabs
pnpm test:package
```

After changing source or tests, refresh all three records before packing. The package
check rejects evidence whose recorded source hashes no longer match the checkout.

The package command writes its archive hash to `artifacts/package-verification.json`.
That hash is kept outside the packed docs to avoid a self-referential archive hash.
The CI badge links to current Linux/macOS results; this page records the local DEV06
verification. The full-suite 100-run repeatability criterion and equivalent native performance
benchmark have **not** been completed. The form-errors and CI-guard milestones are pending.
