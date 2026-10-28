# Dialog API

`assertDialogJourney(page, testInfo, contract): Promise<JourneyResult>` uses the supplied
Playwright Page and current TestInfo. It returns only on a complete pass. Otherwise
it attaches one `journey-result.json` and throws `JourneyAssertionError` with `code`
and `result`. Attachment failure throws `REPORT_WRITE_FAILED`, preserving the primary
scenario checks. There is no restoration of application state after failure.

A Target is `{ id: string, locator: Locator }`. Technical IDs match
`[a-z][a-z0-9_-]{0,63}`; use the same Target object whenever referring to the same ID.
Different IDs must not resolve to the same DOM node. Do not put private data in IDs
or `contractVersion` (1–64 ASCII letters, digits, dots, underscores or hyphens).

Required dialog fields: `id`, `trigger`, `dialog`, `openKey` (`Enter` or `Space`),
`initialFocus`, `tabOrder`, `closeKey` (`Escape`), `returnFocus`.
The nonempty `tabOrder` declares the complete forward cycle without repeated Targets.
`initialFocus` may be a static heading outside that cycle; `returnFocus` may differ
from `trigger`. Locators are resolved again for each observation, so replacing a node
does not retain a stale ElementHandle. Temporary handles are released after each
observation and are never used for actions. Focus identity and dialog containment
are read together in one browser evaluation; a detached node triggers fresh resolution.
The contract's IDs, references and ordering are snapshotted before any await.

| Optional field | Default | Accepted range |
| --- | --- | --- |
| `contractVersion` | `"1"` | 1–64 technical characters |
| `entry.maxTabs` | 25 | integer 1–100 |
| `timeoutMs` | 2000 | integer 100–10000 |
| `scenarioTimeoutMs` | 30000 | integer 1000–120000 |
| `observationWindowMs` | 200 | integer 50–2000, no greater than timeoutMs |

No coercion or clamping. Up to 100 unique Targets, 500 keyboard actions and 5000
planned observations. Invalid configuration gives one `E_CONFIG` blocked observation
and performs no browser action. `observationWindowMs` is retained for the common
contract; dialog checks use positive waits. [Tabs journeys](tabs.md) also use it
for the manual activation observation window.

The runner never clicks, fills, forces focus, dispatches events or changes DOM to make
the component pass. Entry starts at the existing focus and uses Tab. Each activation
key is sent once; polling repeats only observations. If focus leaves the dialog or
another check fails, traversal stops and remaining checks are `not_run` with `blockedBy`.
There is no optional cleanup-Escape branch in this milestone.

Result schema version is `1`; ruleset version is `0.2.0`; package version is separate.
The schema rejects unknown properties. Consumers must also verify coverage arithmetic;
cross-field counts are calculated by the library, not expressed by JSON Schema alone.
Focus is a declared Target ID or `body`, `unknown`, `none`, `unsupported`; comparisons
use actual node identity, not these labels. Avoid those four labels for Target IDs
if you want unambiguous human-readable reports.

The root API exports `assertDialogJourney` and `assertTabsJourney`; the JSON schema is
available at `/schema/journey-result.v1.json`. Form and CI-guard APIs remain pending.
