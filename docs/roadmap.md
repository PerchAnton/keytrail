# Milestones

**Latest status (31 October 2026): the observation-dispatch update passed bounded CI.**
At `cd3216b`, three fresh macOS 15 ARM jobs each passed **172/172**; Linux also
passed **172/172**. Both real package consumers passed in all four jobs. ARM
maximum passing-window gaps were **39.9 / 59.5 / 56.7 ms**, with the unchanged
**100 ms** limit, one worker and zero retries/skips.
[Independently checked results](evidence/ci-observation-dispatch.json).
The change reduces stack-formatting work while retaining fresh locator resolution,
async context, budget checks and cleanup. The earlier 130.3 ms failure is retained;
its exact hosted cause is not fully established, and this short series does not
guarantee shared-host latency. [Why 100 ms and what changed](observation-gaps.md).
The [benchmark](performance.md) retains its historical `1b42666` identity and does
not qualify the changed runtime. Fresh benchmark evidence, final 100-round
acceptance and publication remain pending.

The supplied development specification v1.0 (28 October 2026) defines a full 0.1.0
target. This repository starts with its DEV01–DEV05 dialog checkpoint, designated
`0.1.0-alpha.1`. The current `0.1.0-alpha.6` source candidate includes DEV09 verification
and browser-read optimization, DEV10 examples, and the [release correctness audit](release-audit.md).
These checkpoints are not full 0.1.0 acceptance.

| Stage | Scope | Status |
| --- | --- | --- |
| DEV01–02 | Package, strict contracts, dialog JSON schema, build and compatibility | Implemented for dialogs, tabs and forms |
| DEV03–04 | Keyboard driver, target resolution, plan, statuses, deadlines, minimal attachment | Implemented; cooperative browser-call limits documented |
| DEV05 | Dialog, four required correct cases and six required defects, packaged example | Implemented; see verification record |
| DEV06 | Horizontal/vertical tabs, automatic/manual activation, Home/End and exit | Implemented; see [tabs contract](tabs.md) |
| DEV07 | Form errors, IDREF relationships, focus policies and declarative correction | Implemented; see [form errors contract](form-errors.md) |
| DEV08 | CI completeness guard and subprocess failure tests | Implemented; see [CI guard](ci-guard.md) |
| DEV09 | Repeatability, worker comparison, canaries, equivalent native benchmark | Historical `0300552`: 100 rounds, four-worker comparison and 108 benchmark cases passed; recorded `1b42666` benchmark: 108/108 passed; changed source uses four development rounds until final acceptance; [scope and evidence](reliability.md) |
| DEV10 | Full API docs, vanilla + React portal consumers, release checklist | Implemented for the alpha checkpoint; [release checklist](release-checklist.md); [review snapshot prepared](release-handoff.md); final acceptance and publication pending |

No performance, superiority or adoption claim follows from passing the teaching fixtures.
The [benchmark](performance.md) uses equivalent actions, observations, limits and
serialization, with 5 warmups and 30 alternating measured runs. Its 20% criterion
is evaluated per workload; no average across workloads hides a missed target.
[Full-suite repeatability](reliability.md) retains the original 100-round target.
The historical 45-round checkpoint belongs to alpha.5. The alpha.6 runtime at
`0300552` completed a 100-round series and a matching four-worker run. Later runtime
changes use four-round development series; final acceptance remains deferred. The
optional two-worker protocol is not part of that final acceptance series. Final-candidate
hosted portability checks and publication remain separate steps.

Later candidates may expand browsers and dialog modes only with concrete tests and an
explicit compatibility update. This milestone remains a local test library without
a hosted dashboard, telemetry or unrelated integrations.
