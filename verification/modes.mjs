import assert from 'node:assert/strict';

// Beta and non-prerelease candidates require the same ten rounds. Historical
// candidates retain the policy on their tag.
export function betaFinalRounds(version) {
  assert.match(version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.(?:0|[1-9]\d*))?$(?![\s\S])/, 'No final acceptance policy for this package version');
  return 10;
}

export function reliabilityMode(args, version) {
  assert.equal(new Set(args).size, args.length, 'Duplicate option');
  assert(args.every(arg => ['--final', '--smoke', '--new-series', '--workers=2'].includes(arg)), 'Unknown option');
  assert(!(args.includes('--final') && args.includes('--smoke')), 'Choose final or smoke, not both');
  const mode = args.includes('--final') ? 'final' : args.includes('--smoke') ? 'smoke' : 'development';
  return { mode, rounds: mode === 'final' ? betaFinalRounds(version) : mode === 'smoke' ? 1 : 4,
    workers: args.includes('--workers=2') ? 2 : 1, newSeries: args.includes('--new-series'),
    output: mode === 'final' ? 'artifacts/reliability-verification.json' : `artifacts/reliability-${mode}.json` };
}

export function canResumeReliability(latest, identity, selection) {
  return !!latest && latest.identity === identity && latest.mode === selection.mode &&
    latest.targetRounds === selection.rounds && !selection.newSeries;
}

export function packageMode(args) {
  assert(args.length === 0 || args.length === 1 && args[0] === '--release', 'Use no option for development or --release for final acceptance');
  return args.length === 0 ? 'development' : 'release';
}
