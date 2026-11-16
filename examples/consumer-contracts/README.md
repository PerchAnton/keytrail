# Keyboard contracts on published components

These examples exercise real, pinned packages. They are application-owned
adaptations and experiments, not upstream fixes or claims of adoption.

| Consumer | What the example checks | Boundary |
| --- | --- | --- |
| Swagger UI 5.35.0 | Authorization dialog: naming, focus loop, Escape and return focus | Unmodified UI fails the dialog-role contract; a semantic-only adaptation still lets focus escape |
| Swagger UI 5.35.0 | Request-body tabs: arrows, Home/End and Tab exit | Native checks pass after an application adaptation; inactive panels are unmounted, so the current KeyTrail tabs API reports `STRUCTURE_MISMATCH` |
| Vue 3.5.45 / Reka UI 2.11.0 | Shortcut opening and an explicit return-focus policy | Ctrl/Meta+K uses native Playwright checks; the KeyTrail v1 dialog API supports Enter/Space opening only |
| Base UI 1.9.0 / Sonner 2.0.8 | Toast inside a dialog: first Escape dismisses toast, second closes dialog | Application-owned composition and a separate experimental report, not the KeyTrail v1 schema |

## Run

From the repository root, install the existing development dependencies first:

```sh
pnpm install --frozen-lockfile --ignore-scripts
cd examples/consumer-contracts
npm ci --ignore-scripts
npm run build
npx playwright install chromium
node --test layer-validator.test.mjs
npm test -- --workers=1 --retries=0
```

The build copies the locally built SDK into `artifacts/keytrail` so it resolves
the same Playwright peer as this consumer. It does not modify the SDK. The test
fixture starts a loopback server automatically. JSON and HTML reports live in
`artifacts/`; `npx playwright show-report artifacts/html` opens the report.
`npm start` also prints a local URL for manual inspection. Append
`?example=swagger`, `?example=reka`, or `?example=layers`.

## What the extra contract buys

Native tests are included as a baseline and may be sufficient for a small flow.
The dialog contract additionally produces named checks and actual focus evidence
for the same flow. For example, a semantic-only Swagger adaptation fails on focus
containment; a Reka application return override that contradicts the contract
fails `D07.returned`. Expected negative journeys are asserted explicitly. A green
test suite means those defects were detected, not that every fixture is accessible.

The Swagger adaptation is deliberately local to this pinned DOM. It is not a
drop-in patch for arbitrary Swagger versions. Its tab fixture revealed a real
compatibility boundary: unmounted inactive panels are unsupported by the current
SDK. The native test is useful here; pretending the SDK accepted the structure
would be misleading. No lazy-panel API is added in this example.

For Reka, the pinned package's native shortcut behavior restores the previously
focused field. The default demo explicitly selects its trigger in the close
autofocus callback; `return=other` selects a different field. These are application
policies. They are not presented as a regression in every Reka version.

## Experimental composed layers

`layer-prototype.mjs` is a small fixture-specific experiment. It checks actual
focus before activation, rejects multiple dialogs/toasts, and records initial
and final observations for a 150 ms unchanged window. A gap above **100 ms**
returns `blocked / OBSERVATION_GAP`. Retries are disabled. Its independent strict
validator rejects unknown fields, unsupported states, inconsistent intervals and
incomplete passes. The schema is `consumer-layers-experiment-1`, not a release
proof or public KeyTrail report. It does not measure painting, screen-reader
output, or changes shorter than the observation interval.

The host owns Escape dispatch and focus restoration on toast expiry. A deliberate
host defect is tested separately from the real component baseline. The existing
[upstream layer work](https://github.com/shadcn-ui/ui/pull/12576) is not duplicated.
Promoting this experiment into an SDK API needs another consumer and a separate
contract review.

Local development check on 2026-11-16: three one-worker rounds passed all 19
tests without retries. A separate four-worker comparison passed 18/19: the
deliberate Escape-defect case was blocked by a 117.9 ms observation gap instead
of reaching its expected failure. The threshold stayed at 100 ms. This
experiment is therefore not qualified for concurrent execution; keep the
one-worker command and retain blocked results. These are consumer-example
checks, not a new SDK release or final reliability qualification.
