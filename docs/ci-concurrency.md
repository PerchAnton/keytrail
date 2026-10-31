# Browser worker capacity and deadline checks

The default regression suite uses **one browser worker**. CI requires the complete
suite and package consumers on Linux and ARM `macos-latest`. The separately
measured Intel environment remains a documented failed experiment, not a required
runner or a passing result. Both required jobs still execute every fixture.
The four-worker isolation comparison remains part of the local four-round
verifier. A real gap above 100 ms still blocks a negative observation; retries
remain disabled. Results below identify their source revision and runner.

## Consecutive window reads

The [post-merge main run](https://github.com/PerchAnton/keytrail/actions/runs/41194618651)
at `02ee0953` passed Linux 169/169 and its package consumers. ARM passed 168/169
in the first of three planned rounds. `tabs pass manual Home End` stopped at
`T05.backward.003.unchanged` with a **109.8 ms** gap; its snapshot took **98.514 ms**.
The remaining ARM rounds and package checks did not run. The full raw failure and
snapshot profile are retained; no retry replaces this result.

The previous reader took 12.342 ms, so the old scheduler then slept up to 10 ms.
A short previous read cannot predict the latency of the next one. The follow-up
removes that deliberate pause within negative windows. After checking one complete
snapshot, the driver immediately starts the next asynchronous browser read. There
is no overlapping snapshot or background action chain. Fresh locator resolution,
atomic state reads, cleanup and scenario budgets are unchanged. Positive waits
keep their bounded pauses.

This trades additional observations during each bounded window for more timing
headroom. It cannot make an arbitrary browser or shared host meet a hard deadline:
every actual gap above **100 ms** still blocks, and retries remain zero. The native
benchmark reference uses the same consecutive-read policy; its old numbers are
historical until remeasured. Timing records identify the slow read, not the exact
cause of a runner delay.

A new regression queues a host timer after the first real window snapshot and
requires the next read to start before it runs. Restoring the old pause must fail
that regression. Existing before/after transport-delay tests, short-window coverage,
scenario deadlines, transient component failures and handle cleanup remain required.
Validation is limited to three ARM rounds and one Linux round in ordinary CI;
final 100-round acceptance is not requested.

## Private observation store

Each driver owns one private browser `Map`, accessed through a public Playwright
`JSHandle`. Every snapshot resolves each locator again with `evaluateAll` and
stores the resulting nodes in numbered slots. The final registration synchronously
reads focus, structure and state, then clears the nodes before returning that
snapshot. Other registrations return counts only. There is no additional host
request between completing resolution and reading state. The reader and immutable
contract metadata are sent once per journey; the handle is disposed on completion.

This removes per-element handle serialization and disposal from the hot path.
It does not parse Playwright selectors, cache locator bindings, modify DOM
attributes or install page globals. The error path waits for every resolver before
clearing the map, so a slower sibling cannot repopulate it after cleanup. Replaced
or newly matched targets are resolved afresh; unsupported contexts still block.
An empty foreign locator remains absent and cannot reuse an earlier binding.

Regressions cover coherent focus, detached replacement, a changed selector match
while the old node stays connected, absent targets, sibling cleanup, transport
failure, and dialog focus drift before Enter/Space. Injected browser delays still
must report `OBSERVATION_GAP` and stop activation. The native benchmark reference
independently performs the same transport work; its short pilot checks semantic
equivalence, not release performance. The reader-caching results below separate successful ARM/Linux validation from
the remaining Intel failure. The [local four-round record](evidence/development-cached-reader.json)
passed 676 sequential and 169 four-worker checks with matching semantics and no retries.

## Atomic registration follow-up

The post-merge [main run](https://github.com/PerchAnton/keytrail/actions/runs/41091449659)
passed all 169 cases on Linux but only 168 on macOS ARM. The short manual-tabs
window blocked at `T05.forward.003.unchanged`: its actual gap was 126.7 ms.
The corresponding host snapshot took 126.3 ms, with only 3.9 ms in the final
`page.evaluate` call. Resolution/transport before that call dominated the delay;
these timings do not identify a specific runner or browser scheduling cause.

The follow-up removes that final request and sends immutable metadata only once.
Fresh locator resolution, browser timestamps, cleanup, the 100 ms bound and
zero retries remain unchanged. Opt-in diagnostics now retain the duration of
every locator registration, as well as each complete snapshot. `evaluateMs` counts
separate page evaluations only; zero does not mean the DOM read was instantaneous.
macOS ARM CI runs three complete rounds, stops at the first failure and preserves
each raw report. Linux keeps one complete round. Local verification remains four
rounds plus the separate four-worker comparison.

At `7e48291`, all three ARM rounds passed (507 tests), as did the complete Linux
suite (169) and actual package consumers on both platforms. All raw reports,
semantic signatures, source hashes and package checksums were independently
checked: [CI evidence](evidence/ci-atomic-observations.json). This small sample
supports the change; it cannot guarantee scheduling latency on a shared host.

The new [local proof](evidence/development-atomic-observations.json) confirms
four rounds (676 tests) and the separate four-worker comparison (169), with
800 distinct journey IDs, no retries and matching semantics. Older cached-reader
records are historical for this changed implementation.

| Platform / round | Passed | Largest gap in a passing manual window |
| --- | ---: | ---: |
| Linux / 1 | 169/169 | 29.4 ms |
| macOS ARM / 1 | 169/169 | 44.0 ms |
| macOS ARM / 2 | 169/169 | 69.1 ms |
| macOS ARM / 3 | 169/169 | 48.6 ms |

These maxima include the short 50 ms fixture. Deliberately injected 150 ms gaps
remain blocked and are excluded from passing-window maxima.

## Hosted measurements

The [comparison run](https://github.com/PerchAnton/keytrail/actions/runs/41011980109) executed the complete 165-case suite first
on one worker and then on two on each platform, with no retries or skips.
One worker passed on both platforms. Linux also passed on two; macOS with two
workers had three actual observation-gap failures. The two-worker configuration
is therefore excluded from the ordinary hosted CI configuration, not reported as
passing. At that revision the package stage rejected historical release evidence.
Development package checks are now separate from the explicit final release gate;
see the [verification modes](reliability.md).

| Runner | Workers | Tests | Full snapshot median / p95 (ms) | Evaluate median (ms) | Interval p95 / max (ms) |
| --- | --- | --- | --- | --- | --- |
| Linux | 1 | 165/165 | 21.5 / 23.5 | 1.8 | 26.6 / 46.6 |
| Linux | 2 | 165/165 | 28.4 / 34.6 | 2.5 | 35.7 / 86.0 |
| macOS | 1 | 165/165 | 20.2 / 39.5 | 2.1 | 42.0 / 68.1 |
| macOS | 2 | 162/165 | 36.8 / 82.0 | 2.9 | 83.0 / 116.9 |

The three macOS/two-worker failures were manual Enter, manual Home/End and vertical
manual Home/End. Their full observed intervals and check IDs are retained in the
machine-readable record. The comparison workflow itself failed; its single-worker
browser results provide the basis for the subsequent one-worker configuration.

[Machine-readable records](evidence/ci-workers.json) retain raw-report hashes,
counts and per-fixture summaries. Timing rows include only negative windows in
correct manual-tabs fixtures. Deliberate delays and failures still run in the full
suite but are excluded from these timing aggregates. Host durations use hrtime;
intervals use the browser clock. The evaluate number includes its transport cost,
not just DOM execution. Diagnostics themselves add a small amount of work and are
separate from the [equivalent-work benchmark](performance.md).

The complete snapshot also resolves locators and roles, checks target context,
serializes handles and disposes temporary handles. The difference from evaluate
time points to this surrounding work and browser transport as a substantial cost.
These measurements do not isolate each individual operation. One worker is the
conservative default; a successful two-worker sample does not guarantee that every
shared runner can sustain the required observation rate.

The [initial four-worker CI](https://github.com/PerchAnton/keytrail/actions/runs/41007074630)
had 154 passing and nine failing tests per platform: eight actual observation-gap
failures plus the deadline fixture. Those failures remain recorded. An earlier
diagnostic attempt also failed its attachment-fault regression because diagnostics
used the deliberately failing sink; diagnostics now capture their own original
attachment function. Its timings are not presented as a fully passing run.

Reducing concurrency alone was insufficient. The
[next comparison](https://github.com/PerchAnton/keytrail/actions/runs/41009760872)
passed both Linux runs and macOS with two workers, but macOS with one worker
blocked one manual-tabs fixture on a real 148.5 ms interval. No retry replaced
that result. A subsequent local transport-only change still recorded one 100.7 ms
gap. Both failures motivated the combined change below; they are not counted in
the passing evidence above.

The later [one-worker CI](https://github.com/PerchAnton/keytrail/actions/runs/41019900527)
passed all 165 cases and package consumers on Linux. macOS passed 164/165: manual
Home/End recorded a genuine 111.2 ms gap. The corresponding snapshot took 87.1 ms,
including 3.1 ms in evaluate. This result is retained; one worker alone is not a
guarantee. It motivates the narrower window reads described below. These historical
counts precede the two new observation regressions; they do not certify the new code.

The first [narrow-window run](https://github.com/PerchAnton/keytrail/actions/runs/41025533117)
at `6a9cc6a` passed all 167 browser cases on both platforms. Maximum intervals in
correct manual-tab windows were 29.0 ms on Linux and 61.8 ms on macOS. The overall
workflow still failed: lockfile-free offline resolution omitted TypeScript's native
compiler in the vanilla package consumer. That separate package-harness failure is
retained in the [machine-readable record](evidence/ci-development-window-reads.json).
The vanilla consumer now prepares registry metadata and a frozen lockfile before
its clean offline installation, matching the existing React-consumer approach.
These are individual runner observations, not a guaranteed latency bound.

The [next run](https://github.com/PerchAnton/keytrail/actions/runs/41027146279)
at `611c19f` verified the package fix on Linux: all stages passed. The unchanged
browser code on `macos-latest` passed 165/167, with real 113.5 and 203.2 ms gaps.
For the former, a snapshot took 120.7 ms including 5.5 ms in evaluate. The earlier
passing macOS sample therefore does not establish reliable capacity on that image.

The [Intel experiment](https://github.com/PerchAnton/keytrail/actions/runs/41028417293)
at `8ce3b66` also failed: 163/167, with four actual gaps of 122.6–160.2 ms.
Linux passed all stages including package consumers. More runner capacity alone
did not solve the problem. Both macOS configurations were tested for the
private-store change; neither prior failure is replaced by an unchanged retry.
Each job saves its actual OS, architecture, CPU, memory and image version.

The [first private-store run](https://github.com/PerchAnton/keytrail/actions/runs/41082981018)
at `7e36c39` passed Linux and its package consumers, but remained insufficient on
macOS: ARM passed 168/169 with a 133.1 ms gap; Intel passed 163/169 with six
observation-gap failures. Correct manual-window snapshot medians were 10.7 ms
on ARM and 32.8 ms on Intel; the maximum intervals were 133.1 and 212.2 ms.
These are separate hosted samples, not a controlled performance comparison.
Two local rounds passed 169 cases each; the third was interrupted to refine the
implementation and is excluded. No completed four-round proof is claimed for it.
The next change compiles the state reader once per journey to avoid retransmitting
its full function body at every observation. Earlier failures remain retained.

## Required Linux and ARM CI

The [selected configuration](https://github.com/PerchAnton/keytrail/actions/runs/41087943425)
at `63f9edf` passed every stage on **Linux and macOS ARM**: all 169 browser cases,
39 unit tests, 52 guard subprocess cases and both real tarball consumers per platform.
The runtime/test/verifier hashes match the independently checked four-round record.
No core tests were removed; Intel is checked separately only when requested.

| Runner | Browser tests | Snapshot median / p95 (ms) | Interval p95 / max (ms) |
| --- | --- | --- | --- |
| Linux | 169/169 | 9.8 / 11.6 | 21.7 / 22.4 |
| macOS ARM | 169/169 | 6.4 / 8.7 | 24.4 / 39.5 |

Timing columns cover the correct manual-tabs fixtures. Raw reports, all guard cases,
source hashes and archive checksums were independently validated; [CI evidence](evidence/ci-arm-development.json).
These are observations from the recorded environments, not a universal latency bound.
The prior Intel failure below remains unresolved and is not included as a pass.

## Cached-reader results

At `4abf74c`, the [cached-reader CI](https://github.com/PerchAnton/keytrail/actions/runs/41084977532)
passed every stage on Linux and macOS ARM, including the real tarball consumers.
Intel passed 168/169 browser cases; manual Home/End recorded a **370 ms** gap.
The complete workflow therefore failed. The failure is retained and Intel is not
certified as stable. No retry, omitted fixture or wider tolerance replaces it.

| Runner | Browser tests | Snapshot median / p95 (ms) | Interval p95 / max (ms) | Package consumers |
| --- | --- | --- | --- | --- |
| Linux | 169/169 | 12.3 / 14.4 | 24.6 / 34.0 | Passed |
| macOS ARM | 169/169 | 7.5 / 11.4 | 24.6 / 29.7 | Passed |
| macOS Intel | 168/169 | 29.2 / 46.9 | 48.8 / 370.0 | Not run after failure |

Timing columns include only the correct manual-tabs fixtures, including the one
blocked on Intel. Across all passing negative checks, the maximum gaps were
34.0 ms on Linux and 41.6 ms on ARM. Each platform has 160 journey cases and nine
engine-only cases. All reports use one worker, zero retries and zero skips.
The successful platforms' raw reports, all 52 guard cases, source hashes and exact
archive checksums were independently validated. [Full matrix record](evidence/ci-cached-reader.json)
retains the failed Intel result alongside the successful platforms.

These samples show the achieved cadence on specific runners. They do not establish
a universal speedup or guarantee a 100 ms response from a stalled host. The Intel
outlier remains unresolved. Ordinary CI therefore uses the fully checked ARM
macOS image and Linux; Intel can be investigated separately without claiming a
passing result for it. This selects the required runner, not a subset of tests:
all 169 cases, guard subprocesses and package consumers remain mandatory.
Final 100-round acceptance is still deferred.

## Earlier reductions and the unchanged sampling limit

The atomic DOM read already checks each resolved target's root against the main
document. The earlier change avoided a separate frame-ownership request for every
target. The private-store mechanism retains the atomic context check. When registration
fails, a primitive-only public locator read distinguishes a foreign frame from
an ordinary transport failure. All resolver calls settle before cleanup.
Regressions cover iframe/shadow rejection, replacement, coherent focus, sibling
cleanup, and transport failure in both the main document and an iframe.

Manual-tabs negative windows now omit initial-only name, panel-role and IDREF
metadata work. They still resolve every target, use Playwright's tab-role matching
for structure, and observe focus, selected state, visible panels, roving tabindex
and unsupported contexts. Initial semantic checks use complete snapshots. Omitted
metadata is absent, not recorded as false or reused from a stale read. Regressions
cover replaced tabs and an added tab with fallback role tokens. The native benchmark
uses the same scope in its negative windows; a full new benchmark is deferred.

The negative-window scheduler targets 25 ms, one quarter of the 100 ms gap budget,
with a maximum 10 ms pause and a minimum 1 ms yield. This leaves more room for a
slower next read at the cost of more frequent sampling. The fixture-specific native
benchmark uses the same context strategy and cadence. No scheduler can guarantee
100 ms observations on a stalled host: actual browser timestamps still determine
whether the journey blocks, and every excessive gap remains a failure in CI.

## A deadline at a controlled point

The manual-window test freezes the host budget clock during preparation, then
advances it to exactly 2000 ms after the first real browser observation enters the
negative window. Integer clock values avoid cancellation at a fractional uptime.
The browser observation clock stays real. The test requires the exact blocked
check, the actual focus/selection, one retained observation, no activation, and no
later keyboard input. Both test hooks are restored even if the test fails.

A separate unit test checks that the total scenario budget is cumulative, caps
each operation and expires at the exact boundary. Existing real-clock dialog and
form budget checks also remain. Production clocks and time limits are unchanged.

## Reproduce

Run these sequentially on an otherwise idle machine:

```sh
pnpm build
pnpm test:browser
KEYTRAIL_PROFILE_SNAPSHOTS=1 PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/browser-workers1.json pnpm exec playwright test --workers=1 --retries=0 --reporter=list,json
KEYTRAIL_PROFILE_SNAPSHOTS=1 PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/browser-workers2.json pnpm exec playwright test --workers=2 --retries=0 --reporter=list,json
pnpm verify:reliability --smoke --workers=2
```

The smoke command compares complete two-, one- and four-worker runs and does not
count as 100-round acceptance. Snapshot timing is a test-only diagnostic mode; it
does not change results or suppress observation-gap failures.
