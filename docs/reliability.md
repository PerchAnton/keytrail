# Full-suite repeatability protocol

## Recorded checkpoint — 28 October 2026

The maintainer accepted **45 complete rounds**, each containing 153 tests, and
requested moving on. All **6,885 sequential executions** passed without retries or
semantic differences. A final 4-worker run passed another 153 tests with identical
observations; 6,900 journey UUIDs were unique across these 46 complete runs.

The started 46th sequential round was interrupted on request and excluded from the
completed-round count. Its 92 passed tests are not included in the 6,885 figure.
There were no unexpected failures before interruption. Raw interrupted evidence is
retained locally and its hash/summary is recorded with the accepted evidence.

The original target remains 100 rounds and is **not met** by this record. The
[version-bound policy](evidence/acceptance-policy.json) accepts the reduced scope
for this source candidate; [the result](evidence/reliability.json) explicitly says
`verified-partial` and `acceptance: false`. This does not waive failing tests.

## Default protocol

The verifier runs the entire integration suite 100 times **sequentially with one
worker**, then once with four workers. There are no retries, filters or expected
runner failures. Intentionally defective components must still produce their
specified failed or blocked journey results inside passing regression tests.

```sh
pnpm build
pnpm verify:reliability
# macOS: caffeinate -is pnpm verify:reliability
```

Run only one verifier at a time in a working copy; checkpoints and report paths
are shared within that copy. Allow several hours on a laptop. Keep the machine awake and avoid other browser or
CPU-heavy work. Node, Playwright, Chromium, OS, architecture and CPU are recorded.
Source, tests, schema, lockfile, package/configuration and verifier inputs are hashed
before the run and checked again around every round. Changing an input prevents
combining old and new rounds into one acceptance result.

Every report is schema/relationship validated. Test/attempt references must match,
run UUIDs must be distinct across rounds and workers, and every test must have one
attempt. The engine-only observation tests are explicitly enumerated exceptions to
the one-journey-attachment rule; they exercise driver state and handle disposal.

The verifier compares scenario/configuration, each check's expected and observed
values, status, message code, dependencies, outcome and coverage. UUIDs, elapsed
time and measured observation-window lengths are excluded. Action counts and step
references are retained in raw reports but excluded from the stable signature:
cooperative budget boundaries can stop after different numbers of valid actions.
Dedicated regression assertions check those budgets and no-action-after-return
behavior in every round.

## Checkpoints and failures

Raw runner reports, logs, a baseline and atomic checkpoints remain in
`artifacts/reliability/<series>/`. A restart with the same inputs/environment
revalidates completed reports before resuming. A failed series is retained and
cannot be resumed as though the failed round never happened. Diagnose the failure;
use `--new-series` to start a new complete series. `--smoke` runs only one sequential
round plus the worker comparison and is explicitly **not** acceptance evidence.

The final machine-readable proof is `artifacts/reliability-verification.json`.
A full run produces the original 100-round acceptance proof. The current checkpoint
instead uses the explicitly reviewed 45-round policy. To reproduce its evidence
from the retained raw files after a requested SIGINT stop and a final 4-worker run:

```sh
node scripts/finalize-reliability.mjs artifacts/reliability/<series> artifacts/dev09-final-workers4.json
```

The finalizer revalidates every complete report, rejects actual failures/retries,
checks the interruption and final isolation run, and records their hashes. It does
not overwrite the interrupted checkpoint. It requires the exact series identity
approved in the policy; a different run needs a reviewed policy update. Historical
focused runs remain separate and are not added to the full-suite count.

This is repeatability evidence for synthetic fixtures in one environment, not a
claim that arbitrary applications cannot be flaky. Hosted Linux/macOS CI checks
portability separately; its ordinary jobs do not repeat the suite 100 times.

## Own-report privacy

Six canary tests cover successful and raw-exception paths for dialogs, tabs and
forms. Five different markers are placed in typed input, error text, an accessible
name, the URL and a raw exception. The tests inspect KeyTrail's JSON attachment,
exception message and stdout/stderr writes. They also verify that input/keyboard
events do not continue after the assertion returns.

This guarantee covers KeyTrail's own output. Playwright API steps, traces,
screenshots, video, other reporters and application logs can contain test data.
Use synthetic values and apply your project's artifact retention rules.
