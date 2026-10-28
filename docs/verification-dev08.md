# Historical DEV08 evidence

This page describes source candidate `0.1.0-alpha.4` at commit
`157079b432f657dee225248b9fe692a324d4632d`. Its focused runs are historical;
use [current verification](verification.md) for the current source and package gate.

# Verification of dialogs, tabs and form errors

Recorded 28 October 2026 on macOS arm64, Node 24.22.1, Playwright 1.64.1,
Chromium 156.0.8078.4. These are results from synthetic fixtures, not customer data.

| Check | Result |
| --- | --- |
| TypeScript | Strict checks for library source, integration tests and Playwright configuration |
| Unit tests | 28 passed: validation, snapshot isolation, traversal plan, outcome/coverage, safe serialization and reporter failure handling |
| Chromium integration tests | 146 passed with 4 workers and 146 passed with 1 worker |
| Observation comparison | All check IDs, statuses, message codes, dependencies and coverage agree across the two runs |
| Required correct dialog variants | Ordinary cycle, single stop, static heading, alternate return Target |
| Required defects | Wrong initial focus, escape outside, broken reverse cycle, Escape ignored, lost return focus, missing accessible name |
| Further regressions | Coherent focus snapshots, replacement during observation, fallback roles, reserved-looking IDs, unsupported return focus, limits, safe reports and attachment failure |
| Tabs cases | Horizontal/vertical automatic, manual Enter/Space, Home/End restoration, delayed activation and replaced nodes |
| Tabs defects and boundaries | Wrong arrow, missing wrap, premature/manual activation, focus drift, selected/visible counts, IDREF, roving, exit, unsupported modes, budgets and safe reports |
| Form cases | First-invalid/live, summary/resubmit, stay, summary links, external messages, supported native controls, Unicode/empty correction and replaced fields |
| Form defects and boundaries | Text, IDREF and invalid state, wrong focus/link, focus loss before insertion, non-editable fields, uncleared errors, limits, contexts and safe reports |
| CI guard subprocesses | 48 cases with asserted actual exit codes; [record](evidence/ci-guard.json) |
| Package consumers | Fresh offline install; ESM/CJS imports and declarations; six Chromium examples plus three corrected journeys with the installed CI guard |

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

The tabs repeatability run covers nine cases 20 times with four workers: the four
required modes, manual Home/End, immediate/delayed premature activation and focus drift
both before roving state settles and within the negative observation window.
[Its record](evidence/tabs-repeatability.json) is separate from the sequential focus run.

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/tabs-repeatability-results.json \
  pnpm exec playwright test tabs.spec.ts \
  --grep 'tabs pass (horizontal automatic|vertical automatic|manual Enter|manual Space|manual Home End)$|tabs detect (premature|late-premature|focus-drift|focus-drift-before-roving)$' \
  --repeat-each=20 --workers=4 --reporter=json
node scripts/record-repeatability.mjs tabs
```

The form repeatability run covers ten cases 20 times with four workers: the three
focus policies, focus drift before insertion, Unicode/empty replacement and mismatches
in a later message, native fragment links and real reload detection. [Its record](evidence/forms-repeatability.json) contains per-case counts.

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/forms-repeatability-results.json \
  pnpm exec playwright test form-errors.spec.ts \
  --grep 'forms pass (firstInvalid live|summary resubmit and links|stay|unicode correction|empty correction)$|forms detect select-drift$|forms identify (second message|second uncleared error)$|forms pass native fragment summary links$|forms still block a real reload during a summary link$' \
  --repeat-each=20 --workers=4 --reporter=json
node scripts/record-repeatability.mjs forms
pnpm test:package
```

After changing source or tests, refresh the four journey/repeatability records and the guard record before packing. The package
check rejects evidence whose recorded source hashes no longer match the checkout.

The package command writes its archive hash to `artifacts/package-verification.json`.
That hash is kept outside the packed docs to avoid a self-referential archive hash.
The CI badge links to current Linux/macOS results; this page records the local DEV08
verification. The full-suite 100-run repeatability criterion and equivalent native performance
benchmark have **not** been completed. The CI guard is implemented; its scope and limits are documented separately.

A hosted CI run exposed a diagnostic race: focus leaving during the roving-state wait
was reported as `ROVING_MISMATCH`. The runner now reports `FOCUS_MISMATCH` as soon as
that loss is observed after confirmed focus. The dedicated before-roving fixture
fails against the previous implementation and passes with the fix. Timed window
fixtures use a wider setup margin so runner load does not move the intended defect
into the preceding check. Keyboard activation remains forbidden after focus loss.

The form implementation has a regression for multi-field diagnosis: if the first
message matches but a later one does not, the group reports the actual mismatching
message, rather than timing out the first matched message. Both visible-message and
clearing phases require one observation in which all declared messages meet the
contract. A failed group leaves the other group members unconfirmed (`not_run`).

Native summary links were also reproduced as an incorrect `NAVIGATION` block during
development. Their fragment change is now allowed only for the declared link action,
with the original Document handle verified afterward. A companion fixture reloads
the same URL and must remain blocked before any correction input.

Reproduce guard evidence after building:

```sh
pnpm test:guard
cp artifacts/guard-verification.json docs/evidence/ci-guard.json
```

The guard cases use synthetic wire-format reports to isolate reporter decisions. They
check real process exits, not only method return values. Separate installed-package
browser tests verify reports from actual dialog, tabs and form assertions.

An initial local focus-repeat run had 798 passes and two timeouts. Both timed-out
tests overlapped host sleep intervals of 61 and 67 seconds in the macOS power log.
That run is excluded from the passing record; [the diagnostic summary](evidence/repeatability-host-sleep.json)
is retained separately. The same source and timeouts were rerun with sleep inhibited
for the command (`caffeinate -is` on macOS), without enabling retries.

The first DEV08 hosted macOS run passed the guard subprocess cases but the integration
harness stopped two long manual Home/End journeys at its 20-second test timeout.
That outer limit was shorter than the library's default 30-second scenario budget.
The harness now allows 45 seconds, matching the consumer examples and leaving setup
and attachment time. Library budgets, expected observations and retries are unchanged.
The recorded local worker/repeat runs above passed under the previous, stricter outer
limit; hosted CI checks the updated harness.
