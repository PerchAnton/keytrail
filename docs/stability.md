# Compatibility and support for 1.x

**Unpublished 1.0.0 candidate.** The current registry release is 0.1.0; its
[original policy](https://github.com/PerchAnton/keytrail/blob/v0.1.0/docs/stability.md)
remains attached to that tag. Runtime behavior is unchanged apart from package metadata.

## Supported contract

- Root ESM/CJS exports: `assertDialogJourney`, `assertTabsJourney`,
  `assertFormErrorsJourney`, `JourneyAssertionError` and the documented TypeScript types.
- `keytrail/ci-guard` default reporter and `CiGuardOptions`; the
  `keytrail/schema/journey-result.v1.json` export and schema-1 report structure.
- Existing contract defaults, error codes, rule identifiers and ruleset 0.4.0.
  The observation gap bound stays 100 ms. A blocked check cannot become a pass by
  hiding missing observations; incomplete reports remain a CI failure.
- Node 24, exact Playwright 1.64.1 and its Chromium, Linux and macOS ARM.
  Future Node majors, other browsers, Windows and Intel macOS are not claimed.

Follow [Semantic Versioning 2.0](https://semver.org/spec/v2.0.0.html). Patches fix
deviations from this contract with a regression and an explanation of changed
results. Compatible additions and deprecations require a minor. Existing entry
points and deprecations remain usable throughout 1.x.

Removing an export, changing defaults or failure semantics, tightening accepted
contracts, extending an exhaustively matchable union, or changing the schema in a
way that breaks existing readers requires a major. The schema is intentionally
strict: do not assume new JSON fields are silently acceptable. A new rule that
rejects a previously valid contract needs a ruleset change **and** either a major
package version or an explicit opt-in preserving old defaults. Package, ruleset
and schema versions describe different boundaries; one does not override another.

Keep the currently supported Node and Playwright peer usable throughout 1.x.
Support may be expanded only with compatibility tests; requiring a new peer or
dropping a supported environment is a major change. Exact report prose, timings,
environment metadata, internal modules and example scaffolding are not API promises.

Maintenance by PerchAnton is best effort, targeting the latest 1.x release once
published. There is no SLA, fixed support term, independent security audit or
accessibility certification. Report bugs with synthetic fixtures, exact versions
and the original failing report. Native Playwright tests remain useful.

## Qualification and migration

No contract or schema migration from 0.1.0 is intended. Package metadata changes
to 1.0.0; old reports retain their original version. Re-run application tests before
upgrading. Do not interpret an unchanged schema as evidence for untested source.

The candidate requires its own ten complete final rounds plus a separate
four-worker run, zero retries/skips and the 100 ms observation bound. Freeze inputs
and obtain explicit authorization before that series. Benchmark, CI guard and both
exact-archive consumers are separate gates. Existing 0.1.0 evidence is historical;
the release gate must stay closed until all candidate-specific evidence is ready.
See [the 1.0 checklist](releases/1.0.0.md).
