# Full-suite repeatability protocol

## Final candidate result: `1187fde`

The explicitly requested local final series completed successfully, on the frozen
`1187fde7e0307705354864e739cb1cccce134165` source. The candidate tag is unchanged.

| Measurement | Result |
| --- | --- |
| Full sequential rounds | 100 × 172 = 17,200 passing test executions, one worker |
| Four-worker comparison | 172/172 passed; same semantic signature as every round |
| Retries, skips, flaky tests and unexpected failures | 0 |
| Distinct journey run IDs | 16,261 across 101 reports; 11 engine-only tests per report have no journey attachment |
| Observation-gap limit | 100 ms, unchanged |
| Series started / finished (UTC) | 2026-10-31 18:24:24 / 22:45:07 |
| Independent validation completed | 2026-10-31 22:45:15 UTC; 1 November 00:45 in Kyiv |
| Environment | Apple M3, Darwin 27.2.0 arm64, Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4 |

The [final proof](evidence/reliability.json), [policy](evidence/acceptance-policy.json)
and [independent validation](evidence/reliability-validation-1187fde.json) agree on
identity `34885215059b2e87247ff89f09cb859e606bec2e797d5d75602eea91c245f9f5`.
The separate validator reread all 101 original reports, verified schemas, relationships,
semantic signatures, environment, distinct IDs and all 51 source / 57 build hashes.
It uses the same report-validation primitives as the series verifier; this is not
an external audit. Raw reports, logs and checkpoints are retained locally under
`artifacts/reliability/2026-10-31T18-24-24-545Z-34885215059b`; their SHA-256 inventory
is committed in the validation record. The inventory is not a public raw-report archive.
No historical rounds or hosted attempts are included in this total.

This completes source-bound reliability for the candidate. It does not upgrade the
existing development tarball to a release-verified archive or authorize publication.
The [handoff](release-handoff.md) lists the remaining archive and review gates.

## Hosted checks and retained development history

**Frozen candidate check:** `1187fde` passed three sequential fresh macOS 15 ARM
jobs and one Linux job, **172 tests each**, with package consumers, zero retries
and the unchanged 100 ms bound. [Validated record](evidence/ci-main-1187fde.json).
This follow-up was limited to four full jobs in total; it is neither the local
four-round-plus-isolation protocol nor final 100-round acceptance. Earlier proofs
remain bound to their recorded sources. [Dispatch investigation](observation-gaps.md).

**Historical main evidence (31 October 2026):** main `1b42666` passed three macOS ARM rounds
(510/510), one Linux round (170/170) and both package consumers per platform, with
zero retries. Maximum ARM observation gaps were 47.4 / 38.4 / 39.5 ms; Linux's
maximum was 26.3 ms, below the unchanged 100 ms limit. [Validated main CI](evidence/ci-main-1b42666.json).
The [historical benchmark for that source](history/performance-1b42666-2026-10-31.md) remains preserved.
The [108-test benchmark](performance.md) was measured at `f9c492b`; its input hashes
match the frozen `1187fde` candidate. Earlier repeatability
proofs remain historical; the current final result is recorded above. This short
sample does not guarantee host scheduling latency; [diagnosis and scope](ci-concurrency.md#consecutive-window-reads).

**Final reliability verified:** The frozen `1187fde` candidate completed **100 × 172 = 17,200** sequential test executions and **172** matching four-worker checks, with a **100 ms** limit and zero retries/skips. All 101 raw reports were independently validated. Development still defaults to four rounds. See the [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

## Current development policy

Use four complete sequential rounds during development, plus a separate four-worker
isolation run. Keep one worker per round, retries disabled and the 100 ms observation
gap limit. The [policy](evidence/development-policy.json) keeps this short protocol
separate from the completed, explicitly requested final series. Its final requirement
remains 100 rounds; do not repeat it for documentation-only changes.

The atomic-registration follow-up changes the implementation and regression hooks.
At `7e48291`, four rounds and the four-worker comparison passed: **676 + 169**
executions, 800 distinct journey IDs, matching signatures and zero retries.
[Independent validation](evidence/development-atomic-observations.json) reread all
five raw reports and checked the recorded source hashes. This proof predates the
consecutive-read scheduler and is historical for current main.
The final series for `1187fde` is now complete and recorded above; no verifier is running.

At `4abf74c`, the private store and cached reader passed **four full rounds × 169 = 676**
sequential executions and **169 four-worker checks**, without retries, skips or
semantic differences. Independent validation reread all five raw reports, compared
the recorded source hashes and confirmed **800 distinct journey IDs**. Nine engine-only
cases per run have no journey attachment. [Cached-reader development proof](evidence/development-cached-reader.json)
explicitly records `finalAcceptance: false`. It does not certify the failed hosted
Intel environment; [platform results](ci-concurrency.md#cached-reader-results) remain separate.

The series on commit `46515dd` was stopped at the maintainer's request after **six
complete rounds × 165 tests = 990 executions**, all successful without retries.
All six raw reports were independently revalidated against that recorded commit;
the earlier four-worker comparison passed 165 cases with matching semantics.
The seventh round was interrupted and is excluded. [Retained results](evidence/development-checks.json)
identify the exact source revision and do not claim 100-round acceptance. Changes since then separate the verification modes and narrow manual-window
reads. The new four-round development record is separate from those six older rounds.

At `6a9cc6a`, the narrower manual-window reads completed the new default protocol:
**four full rounds × 167 = 668 sequential executions**, followed by **167 checks
on four workers**, all passing without retries, skips or semantic differences.
A separate validation reread all five raw reports, verified the recorded source hashes
and confirmed **800 distinct journey IDs**. Seven engine-only tests per run have
no journey attachment. [Retained development record](evidence/development-window-reads.json)
is explicitly `finalAcceptance: false`; it does not replace the historical proof.
The later cached-reader runtime has its own four-round record above;
the 167-case series is not evidence for that change.

## Historical alpha.6 verification at `0300552`

That historical final verification ran locally: **100 full rounds with one worker**, followed
by the four-worker comparison. The dedicated hosted reliability workflow has been
removed and disabled. The final source revision completed the full protocol:

| Measurement | Result |
| --- | --- |
| Full sequential rounds | 100 × 163 = 16,300 passing test executions |
| Final four-worker comparison | 163/163 passed; semantic signatures match every round |
| Retries, skipped tests and unexpected failures | 0 |
| Distinct journey run IDs | 16,160; three engine-only tests per full run have no journey attachment |
| Started / finished (UTC) | 2026-10-29 17:26:55 / 22:31:11 |
| Environment | Apple M3, Darwin 27.2.0 arm64, Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4 |

The [historical proof](evidence/reliability-0300552.json) and [historical policy](evidence/acceptance-policy-0300552.json)
use series identity `191d2d89449e23a319e221949729f6d069d4c57acbb6a432056867bc159b0fed`.
Independent validation reread all 101 raw reports, checked their hashes and source
inputs, and repeated report, signature and UUID validation. The raw reports and
their SHA-256 inventory remain in local artifacts. Benchmark measurements were run
after this series, not concurrently.

## Earlier attempts retained separately

An earlier local alpha.6 series completed **12 rounds of 163 tests** (1,956 executions)
without retries or semantic differences before the session was interrupted. The
incomplete 13th round is retained and excluded. This is not 100-round acceptance.

Those rounds predate the final fixture and polling corrections. They are not added
to the new local series. Local and hosted reports also have different environment
identities and are never combined.

The [first hosted attempt](https://github.com/PerchAnton/keytrail/actions/runs/40912436254)
stopped after round 2: all 163 tests passed in both
rounds, but the budget-expiry fixture sometimes timed out before its first manual
observation. Its raw reports are retained. The fixture now leaves more setup time
and explicitly requires a recorded observation before the expected timeout. The
failed series does not count toward the fresh run. The comparison still includes
observed state; it does not discard the discrepancy.

After this fixture correction, a local smoke run passed all 163 cases with two
and one workers, with matching signatures. Its four-worker run correctly blocked
a manual-tabs journey after a measured 241.6 ms observation gap (162 tests passed,
one failed). This failed smoke run is retained and is not acceptance evidence.
The 100 ms bound is unchanged.

The [second hosted attempt](https://github.com/PerchAnton/keytrail/actions/runs/40916563288)
stopped in the two-worker smoke run: 161 cases passed and two manual-tabs cases
blocked on measured gaps of 105.3 and 112.9 ms. No full-series round started.
The negative-window loop now budgets its pause against the duration of the browser
read, targeting a 50 ms cadence instead of always adding another 20 ms to a slow
read. Actual browser-clock gaps still determine whether a result is blocked;
changing the scheduler cannot turn a gap above 100 ms into a pass.

The [third hosted attempt](https://github.com/PerchAnton/keytrail/actions/runs/40918646493)
passed all 163 cases on two and one workers, with matching signatures. Four workers
produced four blocked journeys with measured gaps of 100.5–104.6 ms (159 tests
passed). The full series did not start. Its raw reports were downloaded before
retiring the workflow; none of these attempts is counted as acceptance evidence.

The historical alpha.5 checkpoint contained 45 complete rounds of 153 tests
(6,885 executions), followed by a matching four-worker run. Its interrupted 46th
round was excluded. That accepted reduced scope does not verify the changed
alpha.6 runtime and is not combined with the new series. The old record remains
in Git history and the retained local raw artifacts.

## Default protocol

The default verifier runs the entire integration suite four times **one complete
round after another**, then checks worker isolation. Only `--final` selects 100 rounds. By default each round uses one worker,
followed by a four-worker run. `--workers=2` runs tests on two workers within each
round and additionally requires a matching one-worker run before the four-worker
run. This optional mode is separate from the current one-worker release protocol.
No rounds overlap, and all cases execute in every round on the same recorded
environment. There are no retries, filters or expected
runner failures. Intentionally defective components must still produce their
specified failed or blocked journey results inside passing regression tests.

```sh
pnpm build
pnpm verify:reliability
# macOS: caffeinate -is pnpm verify:reliability
```

Run only one verifier at a time in a working copy; checkpoints and report paths
are shared within that copy. The four-round check takes about 12–15 minutes on the recorded laptop; the final
100-round check takes several hours. Keep the machine awake and avoid other browser or
CPU-heavy work. Node, Playwright, Chromium, OS, architecture and CPU are recorded.
On macOS, `caffeinate` prevents idle sleep for the command; closing the lid can
still suspend the machine. An interrupted round is not considered complete.
The per-round worker count is part of the series identity. Source, tests, schema,
lockfile, package/configuration and verifier inputs are hashed
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
`artifacts/reliability/<series>/`. A restart with the same inputs/environment and verification mode
revalidates completed reports before resuming. Development, smoke and final modes
cannot resume each other’s checkpoints, even when their source hashes match. A failed series is retained and
cannot be resumed as though the failed round never happened. Diagnose the failure;
use `--new-series` to start a new complete series. `--smoke` runs only one complete
round plus the configured worker comparisons and is explicitly **not** acceptance
evidence. Smoke rounds are not added to the 100-round count.

Development writes `artifacts/reliability-development.json`, smoke writes
`artifacts/reliability-smoke.json`, and only `--final` writes
`artifacts/reliability-verification.json`. Development and smoke records have
`acceptance: false`; they never replace the final proof.

The final source-bound series for `1187fde` has already passed. For a future
explicitly selected candidate with changed verification inputs, the separate protocol is:

```sh
pnpm verify:reliability --final
# Run pnpm benchmark only if benchmark input hashes changed.
# Independently validate raw reports and refresh the committed release evidence.
node scripts/check-package.mjs --release
```

The explicit release package gate requires 100 completed rounds, final mode,
matching source hashes, full benchmark evidence and the four-worker comparison.
The normal `pnpm test:package` still tests the exact archive, imports, types and
both clean consumers, but marks its result `verificationLevel: development` and
`finalAcceptance: false`. Neither command publishes anything.

This is repeatability evidence for synthetic fixtures in one environment, not a
claim that arbitrary applications cannot be flaky. Hosted Linux/macOS CI can check
portability separately. One-worker browser checks passed on Linux and macOS; the
measured two-worker macOS limitations remain in [CI capacity notes](ci-concurrency.md).
Ordinary CI jobs do not repeat the suite 100 times.

## Own-report privacy

Six canary tests cover successful and raw-exception paths for dialogs, tabs and
forms. Five different markers are placed in typed input, error text, an accessible
name, the URL and a raw exception. The tests inspect KeyTrail's JSON attachment,
exception message and stdout/stderr writes. They also verify that input/keyboard
events do not continue after the assertion returns.

This guarantee covers KeyTrail's own output. Playwright API steps, traces,
screenshots, video, other reporters and application logs can contain test data.
Use synthetic values and apply your project's artifact retention rules.
