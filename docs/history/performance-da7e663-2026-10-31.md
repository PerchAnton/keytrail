# Historical benchmark — 31 October 2026, 10:41 UTC (`da7e663`)

These measurements apply to source `da7e66378619816cd9c7e065df95f0e2a6e67661`,
before the consecutive-read scheduler. The records were committed after the measured
revision; their original content is preserved in repository snapshot `1b42666`:
[dialog](https://github.com/PerchAnton/keytrail/blob/1b42666fddf8c6653ae3898cbe99a61c5b671980/docs/evidence/benchmark-dialog.json),
[tabs](https://github.com/PerchAnton/keytrail/blob/1b42666fddf8c6653ae3898cbe99a61c5b671980/docs/evidence/benchmark-tabs.json),
[forms](https://github.com/PerchAnton/keytrail/blob/1b42666fddf8c6653ae3898cbe99a61c5b671980/docs/evidence/benchmark-formErrors.json),
[independent validation](https://github.com/PerchAnton/keytrail/blob/1b42666fddf8c6653ae3898cbe99a61c5b671980/docs/evidence/benchmark-validation.json),
[chart](https://github.com/PerchAnton/keytrail/blob/1b42666fddf8c6653ae3898cbe99a61c5b671980/docs/assets/performance.svg).
The snapshot preserving these files is not their measured source.

| Workload | Native median / p95 (ms) | KeyTrail median / p95 (ms) | Median paired overhead | Ratio of medians |
| --- | --- | --- | --- | --- |
| Dialog | 139.6 / 147.4 | 145.7 / 150.3 | 4.1% | 4.4% |
| Manual tabs | 1673.8 / 1709.0 | 1659.4 / 1678.8 | -0.8% | -0.9% |
| Form errors (insertText) | 139.8 / 152.2 | 143.7 / 151.7 | 2.5% | 2.8% |

All 108 benchmark tests passed without retries: three negative controls and
105 pairs, including five warmups and 30 measured pairs per workload. Both overhead
calculations met the 20% target. The runner was an Apple M3 (8 logical CPUs),
macOS arm64 / Darwin 27.2.0, Node 24.22.1, Playwright 1.64.1 and Chromium 156.0.8078.4.
The run finished at 10:41:55 UTC on 31 October 2026.

Both KeyTrail and the native reference changed after this run. These results and
the [current measurements](../performance.md) are separate experiments, not a
controlled before/after speedup comparison. Do not combine their samples or reuse
their hashes as current evidence. The negative tabs result is not a general speed claim.
[The earlier October 29 record](performance-2026-10-29.md) remains separate.
