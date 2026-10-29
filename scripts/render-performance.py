"""Render the published benchmark records; optional developer tool (Matplotlib)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'keytrail-performance'})

root = Path(__file__).resolve().parents[1]
kinds = [('dialog', 'Dialog'), ('tabs', 'Manual tabs'), ('formErrors', 'Form errors (insertText)')]
records = [json.loads((root / f'docs/evidence/benchmark-{key}.json').read_text()) for key, _ in kinds]
fig = plt.figure(figsize=(10, 6.4), facecolor='#f7f9fc', layout='constrained')
gs = fig.add_gridspec(3, 1, height_ratios=[3, 1.2, .6])
ax = fig.add_subplot(gs[0]); ax.set_facecolor('#f7f9fc')
values = [r['summary']['pairedMedianOverheadPercent'] for r in records]
bars = ax.barh([label for _, label in kinds], values, color=['#2459a6', '#007d75', '#7951ab'], height=.5)
ax.invert_yaxis(); ax.set_xlim(0, 24)
ax.axvline(20, color='#9b4d00', linestyle='--', linewidth=1.4)
ax.text(20.3, -.33, '20% target', color='#9b4d00', fontsize=10)
ax.bar_label(bars, labels=[f'{value:.1f}%' for value in values], padding=7, fontsize=13, fontweight='bold')
ax.set_xlabel('Median paired overhead versus equivalent native Playwright checks (%)', fontsize=10)
ax.set_title(f"KeyTrail {records[0]['version']}: measured overhead", loc='left', fontsize=20, fontweight='bold', pad=24)
ax.spines[['top', 'right', 'left']].set_visible(False); ax.grid(axis='x', alpha=.12); ax.set_axisbelow(True)
ax.tick_params(axis='y', length=0, labelsize=12)
ax2 = fig.add_subplot(gs[1]); ax2.axis('off')
rows = []
for (_, label), r in zip(kinds, records):
    s = r['summary']; rows.append([label.replace(' (insertText)', '\n(insertText)'), f"{s['native']['medianMs']:.1f}", f"{s['keytrail']['medianMs']:.1f}", f"{s['native']['p95Ms']:.1f}", f"{s['keytrail']['p95Ms']:.1f}"])
table = ax2.table(cellText=rows, colLabels=['Milliseconds', 'Native median', 'KeyTrail median', 'Native p95', 'KeyTrail p95'], loc='center', cellLoc='center')
table.auto_set_font_size(False); table.set_fontsize(10); table.scale(1, 1.7)
for (row, col), cell in table.get_celld().items():
    cell.set_edgecolor('#dae1ec'); cell.set_facecolor('#e8eef7' if row == 0 else '#f7f9fc')
    if row == 0: cell.set_text_props(weight='bold')
ax3 = fig.add_subplot(gs[2]); ax3.axis('off')
e = records[0]['environment']; date = records[0]['measuredAt'][:10]
ax3.text(0, .9, f"{date} · {e['cpu']} · {e['platform']} {e['arch']} · Node {e['node']} · Playwright {e['playwright']} · Chromium {e['chromium']}", fontsize=8.5, va='top')
ax3.text(0, .4, '5 warmups + 30 alternating pairs per workload. Synthetic fixtures; setup excluded.\nManual tabs include required observation windows. This is not a general speed or accessibility claim.', fontsize=9, va='top', color='#394960')
(root / 'docs/assets').mkdir(exist_ok=True)
fig.savefig(root / 'docs/assets/performance.svg', metadata={'Date': date, 'Description': 'Measured paired overhead and median/p95 timings; source records in docs/evidence.'})
fig.savefig(root / 'artifacts/performance-preview.png', dpi=150)

svg = root / 'docs/assets/performance.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
