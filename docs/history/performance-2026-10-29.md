# Historical benchmark — 29 October 2026 UTC

These measurements belong to runtime revision `0300552`, after its original
100-round series. They do not describe the later browser-observation changes.
The original records and chart are retained at an immutable repository snapshot:
[dialog](https://github.com/PerchAnton/keytrail/blob/da7e66378619816cd9c7e065df95f0e2a6e67661/docs/evidence/benchmark-dialog.json),
[tabs](https://github.com/PerchAnton/keytrail/blob/da7e66378619816cd9c7e065df95f0e2a6e67661/docs/evidence/benchmark-tabs.json),
[forms](https://github.com/PerchAnton/keytrail/blob/da7e66378619816cd9c7e065df95f0e2a6e67661/docs/evidence/benchmark-formErrors.json),
[chart](https://github.com/PerchAnton/keytrail/blob/da7e66378619816cd9c7e065df95f0e2a6e67661/docs/assets/performance.svg).

| Workload | Native median / p95 (ms) | KeyTrail median / p95 (ms) | Median paired overhead | Ratio of medians |
| --- | --- | --- | --- | --- |
| Dialog | 274.9 / 281.1 | 297.1 / 307.8 | 8.4% | 8.1% |
| Manual tabs | 2219.4 / 2288.3 | 2236.1 / 2251.2 | 0.8% | 0.8% |
| Form errors (insertText) | 282.5 / 292.7 | 295.1 / 297.5 | 4.6% | 4.5% |

All 108 benchmark tests passed without retries: three negative controls and
105 pairs, including five warmups and 30 measured pairs per workload. The runner
was an Apple M3, macOS arm64 / Darwin 27.2.0, Node 24.22.1, Playwright 1.64.1 and
Chromium 156.0.8078.4. The run finished at 22:34 UTC on 29 October.

Both KeyTrail and the equivalent native reference changed after this snapshot.
These figures and the [new measurements](../performance.md) are separate runs,
not a controlled before/after speedup experiment. Do not combine their samples.
