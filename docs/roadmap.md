# Milestones

The supplied development specification v1.0 (28 October 2026) defines a full 0.1.0
target. This repository starts with its DEV01–DEV05 dialog checkpoint, designated
`0.1.0-alpha.1`. The current `0.1.0-alpha.5` source candidate includes DEV09 verification
and browser-read optimization, plus DEV10 examples and first-release preparation.
These checkpoints are not full 0.1.0 acceptance.

| Stage | Scope | Status |
| --- | --- | --- |
| DEV01–02 | Package, strict contracts, dialog JSON schema, build and compatibility | Implemented for dialogs, tabs and forms |
| DEV03–04 | Keyboard driver, target resolution, plan, statuses, deadlines, minimal attachment | Implemented; cooperative browser-call limits documented |
| DEV05 | Dialog, four required correct cases and six required defects, packaged example | Implemented; see verification record |
| DEV06 | Horizontal/vertical tabs, automatic/manual activation, Home/End and exit | Implemented; see [tabs contract](tabs.md) |
| DEV07 | Form errors, IDREF relationships, focus policies and declarative correction | Implemented; see [form errors contract](form-errors.md) |
| DEV08 | CI completeness guard and subprocess failure tests | Implemented; see [CI guard](ci-guard.md) |
| DEV09 | Repeatability, 1/4-worker comparison, canaries, equivalent native benchmark | Verified checkpoint; maintainer accepted 45 rounds instead of 100; [scope and evidence](reliability.md) |
| DEV10 | Full API docs, vanilla + React portal consumers, release checklist | Implemented for the alpha checkpoint; [release checklist](release-checklist.md); publication pending |

No performance, superiority or adoption claim follows from passing the teaching fixtures.
The [benchmark](performance.md) uses equivalent actions, observations, limits and
serialization, with 5 warmups and 30 alternating measured runs. Its 20% criterion
is evaluated per workload; no average across workloads hides a missed target.
[Full-suite repeatability](reliability.md) retains the original 100-round target.
The maintainer accepted 45 complete rounds for this checkpoint; the original target
is explicitly not marked as met.

Later candidates may expand browsers and dialog modes only with concrete tests and an
explicit compatibility update. This milestone remains a local test library without
a hosted dashboard, telemetry or unrelated integrations.
