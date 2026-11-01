# Observation gaps and the 100 ms limit

The execution contract sets a target interval of at most **50 ms** for negative
observations, with an initial and a final reading. A gap greater than twice that
interval is insufficient evidence: **more than 100 ms** produces
`blocked / OBSERVATION_GAP`. Exactly 100 ms remains within the limit.

This is KeyTrail's sampling policy, not a WCAG timing threshold or a human
perception threshold. It does not promise continuous observation: a transient
change between two readings can still be missed. The report records the actual
intervals and states the sampling limitation.

For manual tabs, moving focus must leave the selected tab unchanged until
activation. If two observations are 130.3 ms apart, the component may be correct,
but KeyTrail cannot claim the required observation coverage. Increasing the limit
would accept a larger unobserved interval; it would not make the browser reader
faster. A component mismatch actually observed in that interval still takes
precedence over a sampling gap.

## A 106.5 ms gap on macOS 15 ARM

The [third ARM job](https://github.com/PerchAnton/keytrail/actions/runs/41312102590/job/124864435775)
blocked the vertical manual Home/End case at `T05.restore.001.unchanged`.
The previous observation was at 3093.9 ms on the browser clock. The first of
the next ten callbacks began at 3196.5 ms, and the next observation was at
3200.4 ms. On the host clock the snapshot took 106.87 ms, with just 0.043 ms
between reads. The ten callback bodies each took at most 0.2 ms. Most of the
gap accumulated before the first callback. The trace cannot distinguish time
waiting for Playwright, Chromium or the host scheduler. [Raw reports](https://github.com/PerchAnton/keytrail/actions/runs/41312102590/artifacts/13085498506).

The interaction reader can now resolve several original locators in one
Playwright query. The three-tab fixture has seven declared targets. When their
DOM IDs are distinct and simple, one grouped target query plus three role
queries replaces ten separate calls per subsequent sample. A DOM ID is only
a hint for associating results with slots. Every branch still runs the
original locator and flags any match with an unexpected ID. Changed bindings,
ambiguous results and document mutations that invalidate the grouping return
the reader to individual queries. Only a fresh, complete snapshot enters the
observation window. ID-less controls use the individual path throughout.

The 100 ms limit applies to both paths. Separate controls delay a required
role query before or after its browser callback to exercise genuine gaps. The
published beta and its 100-round qualification refer to the tagged source.

## Earlier 130.3 ms gap on macOS 15

The [retained second-allocation failure](evidence/ci-fresh-arm-allocations.json)
recorded a real 130.3 ms browser-clock gap. The host snapshot took 130.144 ms, with
only 0.047 ms between host reads. There was no deliberate polling pause to remove.
Node user plus system CPU was 37.757 ms. A recorded GC overlapped for 7.042 ms;
that duration does not explain the entire delay. Browser callbacks individually
took at most 0.2 ms but were spread over 83.2 ms.

These measurements locate elapsed time outside the callback bodies. They do not
distinguish all request-dispatch, selector-resolution, transport and scheduling
costs, or prove the exact operating-system cause of the historical stall. Host
and browser clocks have separate origins; only their durations are compared.

## Reducing dispatch overhead

The three-tab fixture uses ten fresh locator queries for each interaction
snapshot. A local CPU profile identified repeated stack capture and source-map
formatting in Playwright as substantial host work. The reader now starts that
batch from a microtask with a short call stack. It also avoids one redundant
async wrapper around each result.

The microtask introduces no timer pause. It preserves the caller's async context;
every query still checks the remaining scenario budget and resolves its locator
afresh through public Playwright APIs. All sibling requests settle before results
or cleanup are processed. Target-order error handling, the atomic DOM read,
handle disposal and the 100 ms check are unchanged. No DOM binding, role result
or previous observation is reused to fill an unobserved interval.

Two new browser cases cover async-context preservation and budget expiry at the
dispatch handoff. Existing cases retain fresh bindings, detached-node recovery,
late-sibling cleanup, timer ordering and both before/after transport-gap controls.

The same two focused tabs cases were profiled locally before and after the change:

| Window snapshot duration | Baseline | Final candidate |
| --- | ---: | ---: |
| Median | 4.084 ms | 3.508 ms |
| p95 (nearest rank) | 5.280 ms | 4.535 ms |
| Maximum | 6.955 ms | 8.682 ms |
| Measured intervals | 352 | 409 |

Both captures passed without retries. Faster polling collected more readings in
the same declared windows. **The maximum did not improve in this small sample.**
These exploratory profiles are not a benchmark, a hosted-stall reproduction or
proof of a worst-case bound. The initial prototype capture is also retained.
[Profile summaries and raw-file hashes](evidence/observation-dispatch-profile.json).

A separate focused probe used the same 24-level async caller chain and identical
bundling options for both implementations. Each formatted 33 stacks for one
warmed interaction snapshot; the total number of formatted frames fell from
**787 to 477**. The existing formatter was forwarded unchanged and restored
afterward. This verifies the reduction in stack-formatting work, rather than
inferring it from elapsed time alone. It does not identify every contributor to
the historical hosted gap.

The bounded hosted comparison is recorded separately in
[CI capacity and diagnostics](ci-concurrency.md). It cannot guarantee that a shared
host never pauses for more than 100 ms. Any such future gap must remain blocked;
successful later samples or repeated test runs must not erase it.
