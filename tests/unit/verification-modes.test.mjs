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

test('the recorded policies agree with the final and development verifier modes', () => {
  const acceptance = read('../../docs/evidence/acceptance-policy.json');
  const development = read('../../docs/evidence/development-policy.json');
  const final = reliabilityMode(['--final'], version);
  assert.equal(acceptance.version, version);
  assert.equal(acceptance.referenceTargetRounds, final.rounds);
  assert.equal(acceptance.minimumCompletedRounds, final.rounds);
  assert.equal(development.finalAcceptanceRounds, final.rounds);
  assert.equal(development.developmentRounds, reliabilityMode([]).rounds);
  assert.throws(() => reliabilityMode(['--final'], '0.1.0-alpha.6'), /No final acceptance policy/);
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

test('stable and beta versions retain ten final rounds and reject unsupported labels', () => {
  for (const v of ['0.1.0', '1.0.0', '0.1.0-beta.2']) {
    assert.equal(reliabilityMode(['--final'], v).rounds, 10);
  }
  for (const v of ['0.1.0-alpha.6', '0.1.0-rc.1', '01.0.0', '0.1.0-beta.02', '0.1.0+build', '0.1.0\n']) {
    assert.throws(() => reliabilityMode(['--final'], v), /No final acceptance policy/);
  }
});
