# Milestones

The supplied development specification v1.0 (28 October 2026) defines a full 0.1.0
target. This repository starts with its DEV01–DEV05 dialog checkpoint, designated
`0.1.0-alpha.1`. The current `0.1.0-alpha.3` source candidate includes DEV06–DEV07.
These checkpoints are not full 0.1.0 acceptance.

| Stage | Scope | Status |
| --- | --- | --- |
| DEV01–02 | Package, strict contracts, dialog JSON schema, build and compatibility | Implemented for dialogs, tabs and forms |
| DEV03–04 | Keyboard driver, target resolution, plan, statuses, deadlines, minimal attachment | Implemented; cooperative browser-call limits documented |
| DEV05 | Dialog, four required correct cases and six required defects, packaged example | Implemented; see verification record |
| DEV06 | Horizontal/vertical tabs, automatic/manual activation, Home/End and exit | Implemented; see [tabs contract](tabs.md) |
| DEV07 | Form errors, IDREF relationships, focus policies and declarative correction | Implemented; see [form errors contract](form-errors.md) |
| DEV08 | CI completeness guard and subprocess failure tests | Not started |
| DEV09 | 100-run full-suite repeatability, 1/4-worker comparison, equivalent native benchmark | Not accepted yet |
| DEV10 | Full API docs, vanilla + React portal consumers, full 0.1 release checklist | Partial: vanilla dialog, tabs and forms |

No performance, superiority or adoption claim follows from passing the teaching fixtures.
The future benchmark must use identical actions, observations, limits and serialization,
5 warmups and 30 alternating measured runs, with median/p95 and environment details.
The 20% median overhead criterion is a target, not an existing measurement.

Later candidates may expand browsers and dialog modes only with concrete tests and an
explicit compatibility update. This milestone remains a local test library without
a hosted dashboard, telemetry or unrelated integrations.
