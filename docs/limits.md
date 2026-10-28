# Limits and data handling

The dialog scenario supports one custom ARIA dialog in the main document, including a
portal into that same document. It targets Chromium only. Native HTML dialogs,
alertdialog, multiple visible/nested dialogs, iframe targets, ShadowRoot targets,
navigation, popups and Page closure are blocked when observed. It cannot detect all
closed shadow trees or transient/hidden third-party layers.

Only checked states are covered; focus might move briefly between observations. There
is no claim about screen-reader announcements, pointer interaction, background inertness,
all accessibility rules or physical keyboard/IME behavior. Use synthetic fixtures and
prepare the application before the journey. The contract expects a stable set of stops;
asynchronous appearance and replacement of the same declared element are supported.

The monotonic scenario budget is checked before and after browser operations. Locator
waits receive the remaining budget. In-flight browser calls are cooperative; the enclosing
Playwright test timeout remains the final bound. KeyTrail does not change that timeout,
use Promise.race with unfinished actions, or start more keyboard actions after returning.
An unsupported JavaScript browser modal is dismissed solely to unblock the in-flight
keyboard call, then the journey stops as blocked. No page DOM is restored or repaired.

Own JSON and errors contain only technical IDs, fixed message codes, safe state facts,
times, versions and a SHA-256 test reference. They omit selectors, URL, page text,
accessible names, field values, cookies, storage and raw browser errors. Unknown contract
fields are ignored rather than serialized. IDs are supplied by trusted test code and
must not contain private data. This package is not a sandbox for hostile Locator objects.

Playwright's own HTML reports, internal API steps, traces, screenshots or videos can
contain page data even when KeyTrail's JSON does not. KeyTrail never changes those settings.
The examples disable trace/screenshot/video and use only synthetic data. A killed worker
may produce no attachment. The opt-in [CI guard](ci-guard.md) rejects missing and incomplete reports, including
recovered retries. Its guarantee is limited to discovered tests and trusted test code;
it cannot prove that required files were not excluded or reports were not fabricated.

Tabs support fixed LTR lists with at least two enabled tabs and mounted panels. See
[the tabs contract](tabs.md) for role relationships, manual observation windows and
unsupported modes. Perpendicular arrows, scrolling and screen-reader output are not tested.

Form journeys support `novalidate` forms, native text inputs/textarea, declared error
messages and keyboard correction. See [the form contract](form-errors.md). The library
checks only the listed errors; cleared errors do not prove a successful save or an
announced success state. Mock application submissions in setup. Corrections use synthetic
values, select-all and `keyboard.insertText` (Backspace for an empty string); they do not
model per-character keydown, physical keyboards or IME behavior.

A declared form-summary link may perform native same-document fragment navigation.
The original Document must survive that action and its observations; a full reload
of the same URL is still blocked. Other actions retain the ordinary navigation guard.
