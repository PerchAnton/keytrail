# Changelog

## 0.1.0-alpha.6 — source candidate

- Recheck dialog-trigger focus in the activation preflight. Stop with
  `FOCUS_MISMATCH` before Enter/Space and report the actual observed focus.
- Require initial/final manual-tabs observations spanning the declared window.
  Record browser-clock intervals and block gaps above 100 ms with `OBSERVATION_GAP`.
  Validate sampling evidence in the serializer and CI guard.
- Add opt-in `inputMode: 'type'` for printable ASCII keyboard events. Recheck
  focus/editability before each character, retain the Unicode `insertText` default,
  and report the selected mode without recording values or typed characters.
- Extend alpha schema v1 and advance the behavioral ruleset to 0.4.0. Pair the
  assertions with the schema/guard from the same package version.
- Add regressions for focus drift, slow browser transport, blocked character input,
  interrupted typing, unsupported characters and invalid observation reports.
- Refresh source-bound verification before publication. No release published.

## 0.1.0-alpha.5 — source candidate

- Add a separate React 19.3.1 portal example with StrictMode, remounting, two
  deliberate focus defects and a real failing-process control.
- Verify two clean offline tarball consumers, standard HTML/JUnit reporters,
  incomplete attachment dependencies, archive checksums and release artifacts.
- Add a report-reading guide, first-alpha notes and a release checklist.
- Resolve independent browser targets and roles concurrently, while awaiting every
  read before observing state or disposing temporary handles. Preserve deterministic
  error ordering and stop before further keyboard actions on failure.
- Avoid link-role resolution when the form contract declares no summary links.
- Add five-value canary checks on successful and exceptional paths for all scenarios,
  plus a regression for delayed handle cleanup after a sibling resolution error.
- Add a resumable, source-bound 100-round full-suite verifier and worker comparison.
- Add a fixture-specific native Playwright benchmark with paired measurements,
  semantic equivalence checks, negative controls and published raw timing samples.
- Record 45 full sequential rounds (6,885 executions) and matching four-worker
  results. The maintainer accepted this reduced scope; retain the interrupted
  next round separately and do not claim the original 100-round target.
- Ruleset 0.3.0 and schema version 1 remain. No package or GitHub release published.

## 0.1.0-alpha.4 — source candidate

- Add the opt-in `keytrail/ci-guard` reporter: require one schema-valid, complete
  passing journey for every discovered test and attempt in a named project.
- Reject skipped/expected failures, missing reports and recovered retries; preserve
  overall failures, interruption and timeout. Bound attachments to 5 MiB.
- Convert reporter read/parse/internal errors into an explicit failed run status.
- Centralize allowlist serialization and report relationship validation. Compile the
  schema validator at build time without adding an installed runtime dependency.
- Add actual subprocess exit-code checks and a guarded package consumer example.
- Ruleset 0.3.0 and schema version 1 remain; check/dependency IDs now have an explicit
  technical-identifier pattern. Full 0.1 acceptance and publication remain pending.

## 0.1.0-alpha.3 — source candidate

- Add `assertFormErrorsJourney` and `FormErrorsContract` with first-invalid, summary
  and stay focus policies, summary links, live validation and resubmission.
- Check rendered error text, unique message IDREF, invalid state, exact correction
  values and simultaneous clearing of all declared errors.
- Support native fragment summary links while blocking actual document replacement.
- Reach fields with Tab; confirm focus/editability before select-all and text insertion.
  Stop before inserting when focus has moved. Keep text and values out of own reports.
- Add F01–F06 plans, form codes and value-free insertion steps to schema v1;
  ruleset version is 0.3.0. Include correct/broken packaged form examples.
- CI completeness enforcement and full 0.1 acceptance remain pending. No publication.

## 0.1.0-alpha.2 — source candidate

- Add `assertTabsJourney` and `TabsContract`: horizontal/vertical navigation, automatic
  and manual activation, full wrap in both directions, optional Home/End and Tab exit.
- Check per-pair roles and IDREF, unique selection, visible panels and roving tabindex.
- Observe manual selection before activation, record the window, and stop on focus drift.
- Extend schema v1 with tabs observations and keyboard keys; ruleset version is 0.2.0.
- Add correct/broken packaged tabs examples and verification evidence.
- Report manual focus loss during the roving-state wait as `FOCUS_MISMATCH`, with a
  dedicated regression and timing margins for hosted runners.
- Forms and CI completeness enforcement remain pending. No package release published.

## 0.1.0-alpha.1 — source checkpoint

- First dialog checkpoint: keyboard entry, semantics, focus cycles, Escape and return.
- Preplanned observations, explicit incomplete coverage and safe JSON attachment.
- Config, context, entry, action and cooperative time limits.
- Correct/defective fixtures, ESM/CJS declarations and a clean packaged vanilla example.
- Coherent focus observations, fresh resolution after detachment, and explicit context
  checks for shadow/iframe return focus. Fallback roles follow Playwright semantics.
- Stricter contract validation and English-only public documentation.
- No npm or GitHub release published yet; this is not full 0.1.0 acceptance.
