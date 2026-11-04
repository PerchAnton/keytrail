import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reliabilityMode, canResumeReliability, packageMode } from '../../verification/modes.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const version = read('../../package.json').version;

test('development runs four rounds without writing final acceptance evidence', () => {
  const development = reliabilityMode([]), final = reliabilityMode(['--final'], version), smoke = reliabilityMode(['--smoke']);
  assert.equal(development.rounds, 4); assert.equal(development.mode, 'development');
  assert.equal(final.rounds, 10); assert.equal(final.mode, 'final');
  assert.equal(smoke.rounds, 1);
  assert.equal(new Set([development.output, final.output, smoke.output]).size, 3);
  assert.throws(() => reliabilityMode(['--final', '--smoke']));
  assert.throws(() => reliabilityMode(['--final', '--final']));
  assert.throws(() => reliabilityMode(['--rounds=100']));
});

test('the recorded beta policies agree with the final and development verifier modes', () => {
  const acceptance = read('../../docs/evidence/acceptance-policy.json');
  const development = read('../../docs/evidence/development-policy.json');
  const final = reliabilityMode(['--final'], version);
  assert.equal(acceptance.version, version);
  assert.equal(acceptance.referenceTargetRounds, final.rounds);
  assert.equal(acceptance.minimumCompletedRounds, final.rounds);
  assert.equal(development.finalAcceptanceRounds, final.rounds);
  assert.equal(development.developmentRounds, reliabilityMode([]).rounds);
  assert.throws(() => reliabilityMode(['--final'], '0.1.0-alpha.6'), /No beta final policy/);
});

test('a short or legacy series cannot resume as a final series', () => {
  const development = reliabilityMode([]), final = reliabilityMode(['--final'], version);
  const latest = { identity: 'source', mode: development.mode, targetRounds: development.rounds };
  assert(canResumeReliability(latest, 'source', development));
  assert(!canResumeReliability(latest, 'source', final));
  assert(!canResumeReliability({ ...latest, mode: 'final' }, 'source', final));
  assert(!canResumeReliability({ ...latest, mode: 'final', targetRounds: 100 }, 'source', final));
  assert(!canResumeReliability({ identity: 'source', smoke: false }, 'source', development));
  assert(!canResumeReliability(latest, 'changed', development));
  assert(!canResumeReliability(latest, 'source', reliabilityMode(['--new-series'])));
});

test('package final acceptance requires an explicit release option', () => {
  assert.equal(packageMode([]), 'development');
  assert.equal(packageMode(['--release']), 'release');
  assert.throws(() => packageMode(['--release', '--development']));
  assert.throws(() => packageMode(['--relase']));
});
