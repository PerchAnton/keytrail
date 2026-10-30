# Release correctness audit — alpha.6

This candidate addresses two false-positive paths found during review of alpha.5
and adds an explicit keyboard-input mode. The priority is what a passing report
actually proves. These are synthetic regressions, not reports about a third-party
application.

| Reproduction | Alpha.6 result | Evidence |
| --- | --- | --- |
| Focus moves from the declared opener to a different button that can open the same dialog | D01 fails with `FOCUS_MISMATCH`; observed focus is `unknown`; no Enter/Space is sent | [Both activation keys](../tests/integration/dialog.spec.ts) |
| Add 150 ms of transport delay before or after browser evaluation during a short manual-tabs window | T05 is blocked with `OBSERVATION_GAP`; two real observations and their interval are retained; no activation follows | [Slow observations and a healthy short window](../tests/integration/tabs.spec.ts) |
| Cancel character keydown events on an otherwise working form | `type` fails F06 with `VALUE_MISMATCH`; `insertText` still passes its narrower input contract | [Input modes](../tests/integration/form-errors.spec.ts) |
| Move focus during the first typed character | F06 fails with `FOCUS_MISMATCH`; no second character is typed | [Typing interruption](../tests/integration/form-errors.spec.ts) |
| Request Unicode/control characters in `type` mode | `CONFIG_INVALID` before submission; no silent fallback or private value in the report | [Input validation](../tests/unit/form-errors.test.mjs) |
| Claim a passing window with missing evidence or a gap above 100 ms | The CI guard rejects the report and the process exits 1 | [Guard subprocess cases](../scripts/check-guard.mjs) |

The 100 ms boundary has a deterministic unit test: exactly 100 ms is allowed;
100.125 ms blocks the window, even after later fast samples. Window duration is
measured between actual browser snapshots, not from time spent awaiting the first
snapshot. At least two observations are required. Values are checked against the
JSON schema and cross-field relationships before attachment.

The dialog preflight is still a snapshot followed by a separate Playwright command.
It rejects the observed wrong target; it does not make those operations atomic.
Manual-tabs checks sample a declared window after focus and roving checks. A
transient change entirely between reads can remain undetected. Neither input mode
claims to emulate an IME or physical keyboard layout.

Ruleset **0.4.0** identifies these behavioral changes. The alpha schema-v1 extension
adds sampling metrics, the gap code, form mode and value-free `type` steps. Use a
matching package version for the assertions, schema and CI guard. The default
form mode remains `insertText` for existing contracts; new keyboard-oriented
examples select `type` explicitly.

The [machine-readable regression record](evidence/release-audit.json) extracts all
ten added browser cases from the final four-worker comparison after the 100-round
local series and binds them to the source hashes and raw-report checksum.
The injected-delay cases measured gaps above 150 ms and
both stopped as blocked. These are diagnostic samples, not performance claims.

Verification and source-bound evidence are listed in [Verification](verification.md).
The updated [benchmark](performance.md) uses an independent native implementation
with the same negative-window requirements. Its form timings cover `insertText`.
