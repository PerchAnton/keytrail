# Browser worker capacity and deadline checks

The default regression suite uses **one browser worker**. Hosted macOS uses the
explicit `macos-15-intel` image; local repeatability also covers the recorded arm64 Mac. The four-worker isolation
comparison remains an explicit part of the local full-suite verifier. A real gap
above 100 ms still blocks a negative observation; retries remain disabled.

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

Hosted macOS now selects `macos-15-intel` explicitly. GitHub lists this standard
public-repository runner with four CPUs and 14 GB RAM, compared with three CPUs
and 7 GB for its arm64 labels; see the [runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
This is a capacity/configuration choice, not proof that architecture alone caused
the stalls. The full suite and package checks remain mandatory, with one worker,
zero retries and the same 100 ms bound. Each job saves its actual OS, architecture,
CPU, memory and image version. The failed arm64 hosted runs remain evidence of
that environment's observed limits; local arm64 results do not erase them.

## Reduce transport work and reserve sampling time

The atomic DOM read already checks each resolved target's root against the main
document. Successful reads now avoid a separate frame-ownership request for every
target. If handle adoption or evaluation fails, public frame queries distinguish
an unsupported foreign context from an ordinary browser error. Locators are still
resolved for each observation, all reads settle, and temporary handles are disposed.
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
