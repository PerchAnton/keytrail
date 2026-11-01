import { inspectReleaseEvidence } from './lib/release-evidence.mjs';

try {
  if (process.argv.slice(2).some(arg => arg !== '--json') || process.argv.length > 3) {
    throw new Error('Usage: node scripts/check-release-readiness.mjs [--json]');
  }
  const report = await inspectReleaseEvidence();
  report.scope = 'Saved final evidence only. No tests, builds, file writes or publication.';
  report.remaining = [
    'Confirm the selected candidate identity and retain its independently validated raw final reports.',
    'Pass node scripts/check-package.mjs --release and preserve the exact verified archive.',
    'Complete owner review and confirm registry access and publication authorization.',
  ];
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.package} ${report.version}: final evidence ${report.evidenceReady ? 'ready for package verification' : 'pending'}`);
    for (const c of report.checks) console.log(`${c.status.toUpperCase()} ${c.id}${c.reason ? ': ' + c.reason : ''}`);
    console.log('\nStill required:\n' + report.remaining.map(s => '- ' + s).join('\n'));
  }
  process.exitCode = report.evidenceReady ? 0 : 1;
} catch (error) {
  console.error(`Cannot inspect release evidence: ${error.message}`);
  process.exitCode = 2;
}
