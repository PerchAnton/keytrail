# Rules and message codes

| Rule | Observation |
| --- | --- |
| D01 | Trigger reached by Tab or already focused, confirmed in the pre-action snapshot; open key sent once |
| D02 | Visible custom dialog, dialog role, nonempty accessible name, aria-modal=true |
| D03 | Initial focus equals the declared Target |
| D04 | Complete forward and reverse Tab cycles, including wrapping |
| D05 | Focus remains inside the dialog at observed states |
| D06 | One Escape hides or removes the dialog |
| D07 | Focus returns to the declared Target |

Instance IDs include `D02.name`, `D04.forward.003`, `D05.backward.001`, `D07.returned`.
All instances are planned before actions. If initial focus is outside the Tab cycle,
one extra forward Tab enters its first element, followed by a full cycle.

| Code | Meaning |
| --- | --- |
| OK / NOT_RUN | Observed pass / dependent observation not attempted |
| CONFIG_INVALID | Invalid contract, bounds or reused ID with a different Target object |
| TARGET_AMBIGUOUS / TARGET_ALIAS | Multiple locator matches / different IDs resolve to one node |
| UNSUPPORTED_CONTEXT | Foreign Page, iframe, observed ShadowRoot or unsupported focused boundary |
| UNSUPPORTED_DIALOG | Native, visible multiple/nested dialog, alertdialog or browser modal |
| PAGE_CLOSED / NAVIGATION / POPUP | Page lifecycle interruption |
| ENTRY_LIMIT / ACTION_LIMIT | Keyboard limit reached |
| OBSERVATION_GAP | Manual-tabs sampling gap exceeds 100 ms; the negative check is blocked |
| SCENARIO_TIMEOUT | Total cooperative time budget expired |
| EXPECTATION_TIMEOUT | Required visibility/closed state not observed in time |
| FOCUS_MISMATCH / FOCUS_OUTSIDE_DIALOG | Wrong expected focus / failed observed containment |
| ROLE_MISMATCH / NAME_MISSING / MODAL_MISMATCH | Dialog semantics mismatch |
| BROWSER_ERROR | Other browser error, with its raw text excluded |
| REPORT_WRITE_FAILED | Result attachment could not be written |

The [W3C APG modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
informs modal semantics and containment. Declared focus targets, complete cycles,
limits and reporting are KeyTrail's test contract. A failed rule is not automatically
a specific WCAG violation. Roles and accessible names use Playwright's public
[`getByRole`](https://playwright.dev/docs/locators#locate-by-role) implementation;
KeyTrail does not implement a separate accessible-name algorithm.

## Other journeys

[Tabs rules T01–T08](tabs.md) cover navigation, selection and manual activation.
[Form rules F01–F06](form-errors.md) cover messages, field relationships, focus and correction.
Form-specific codes are `UNSUPPORTED_FORM`, `TEXT_MISMATCH`, `INVALID_STATE_MISMATCH`,
`NOT_EDITABLE`, `VALUE_MISMATCH` and `ERROR_NOT_CLEARED`; they also use the shared
`IDREF_MISMATCH`, `STRUCTURE_MISMATCH`, focus, context and budget codes.
