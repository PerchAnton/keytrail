# Full-suite repeatability protocol

## Alpha.6 verification in progress

The local alpha.6 series completed **12 rounds of 163 tests** (1,956 executions)
without retries or semantic differences before the session was interrupted. The
incomplete 13th round is retained and excluded. This is not 100-round acceptance.

A separate [hosted workflow](../.github/workflows/reliability.yml) runs all 100 rounds
on one Linux runner, then the four-worker comparison. It continues independently
of a developer laptop. Local and hosted rounds have different environment identities
and are never combined. Until the hosted verifier produces its final source-bound
proof, the release gate remains pending.

The workflow has read-only repository permission, does not publish or modify the
repository, and retains raw reports plus the final proof for 14 days. Download the
artifact before it expires. Its bootstrap push trigger is restricted to this
preparation branch and workflow path; once on the default branch, future runs can
be started explicitly with `workflow_dispatch`. Ordinary documentation pushes do
not start another multi-hour run.

The historical alpha.5 checkpoint contained 45 complete rounds of 153 tests
(6,885 executions), followed by a matching four-worker run. Its interrupted 46th
round was excluded. That accepted reduced scope does not verify the changed
alpha.6 runtime and is not combined with the new series. The old record remains
in Git history and the retained local raw artifacts.

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
time, measured observation-window lengths, sample counts and interval arrays are
excluded. Their consistency and gap bounds are checked in every individual report. Action counts and step
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
A full run produces the original 100-round acceptance proof. The package gate must
match the version, series identity, all source hashes, per-round signatures and
final four-worker result. A failure is never converted into passing evidence by
editing its metadata. The historical partial-series finalizer remains available
for reproducing the earlier checkpoint; it does not waive the new release gate.

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
