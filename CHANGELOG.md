# Changelog

## 0.1.0-alpha.2 — source candidate

- Add `assertTabsJourney` and `TabsContract`: horizontal/vertical navigation, automatic
  and manual activation, full wrap in both directions, optional Home/End and Tab exit.
- Check per-pair roles and IDREF, unique selection, visible panels and roving tabindex.
- Observe manual selection before activation, record the window, and stop on focus drift.
- Extend schema v1 with tabs observations and keyboard keys; ruleset version is 0.2.0.
- Add correct/broken packaged tabs examples and verification evidence.
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
