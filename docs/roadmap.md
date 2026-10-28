# Milestones

The supplied development specification v1.0 (28 October 2026) defines a full 0.1.0
target. This repository starts with its DEV01–DEV05 dialog checkpoint, designated
`0.1.0-alpha.1`. That checkpoint is not full 0.1.0 acceptance.

| Stage | Scope | Status |
| --- | --- | --- |
| DEV01–02 | Package, strict contracts, dialog JSON schema, build and compatibility | Implemented for dialog milestone |
| DEV03–04 | Keyboard driver, target resolution, plan, statuses, deadlines, minimal attachment | Implemented; cooperative browser-call limits documented |
| DEV05 | Dialog, four required correct cases and six required defects, packaged example | Implemented; see verification record |
| DEV06 | Horizontal/vertical tabs, automatic/manual activation, Home/End and exit | Not started |
| DEV07 | Form errors, IDREF relationships, focus policies and declarative correction | Not started |
| DEV08 | CI completeness guard, subprocess failure tests, complete three-scenario schema | Not started |
| DEV09 | 100-run full-suite repeatability, 1/4-worker comparison, equivalent native benchmark | Not accepted yet |
| DEV10 | Full API docs, vanilla + React portal consumers, full 0.1 release checklist | Partial: vanilla dialog only |

No performance, superiority or adoption claim follows from passing the teaching fixtures.
The future benchmark must use identical actions, observations, limits and serialization,
5 warmups and 30 alternating measured runs, with median/p95 and environment details.
The 20% median overhead criterion is a target, not an existing measurement.

Later candidates may expand browsers and dialog modes only with concrete tests and an
explicit compatibility update. No cloud dashboard, AI scoring, telemetry or unrelated
integrations are part of this milestone.
