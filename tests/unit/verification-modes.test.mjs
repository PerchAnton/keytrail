import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reliabilityMode, canResumeReliability, packageMode } from '../../verification/modes.mjs';

test('development runs four rounds without writing final acceptance evidence', () => {
  const development = reliabilityMode([]), final = reliabilityMode(['--final']), smoke = reliabilityMode(['--smoke']);
  assert.equal(development.rounds, 4); assert.equal(development.mode, 'development');
  assert.equal(final.rounds, 100); assert.equal(final.mode, 'final');
  assert.equal(smoke.rounds, 1);
  assert.equal(new Set([development.output, final.output, smoke.output]).size, 3);
  assert.throws(() => reliabilityMode(['--final', '--smoke']));
  assert.throws(() => reliabilityMode(['--final', '--final']));
  assert.throws(() => reliabilityMode(['--rounds=100']));
});

test('a short or legacy series cannot resume as a final series', () => {
  const development = reliabilityMode([]), final = reliabilityMode(['--final']);
  const latest = { identity: 'source', mode: development.mode, targetRounds: development.rounds };
  assert(canResumeReliability(latest, 'source', development));
  assert(!canResumeReliability(latest, 'source', final));
  assert(!canResumeReliability({ ...latest, mode: 'final' }, 'source', final));
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
