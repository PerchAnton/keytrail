import { setTimeout as delay } from 'node:timers/promises';

// Research-only contract for this fixture. Not a KeyTrail v1 journey/result schema.
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const focuses = ['layers-open', 'show-notice', 'layers-close', 'notice', 'body', 'unknown'];
const keys = ['Enter', 'Escape', 'Alt+t'];
function validState(state) {
  return fields(state, ['focus', 'dialogs', 'notices']) && focuses.includes(state.focus)
    && Number.isInteger(state.dialogs) && state.dialogs >= 0 && Number.isInteger(state.notices) && state.notices >= 0;
}
const matches = (a, b) => a.focus === b.focus && a.dialogs === b.dialogs && a.notices === b.notices;

export function validateLayerReport(report) {
  if (!fields(report, ['schema', 'limitMs', 'windowMs', 'planned', 'outcome', 'steps'])
    || report.schema !== 'consumer-layers-experiment-1' || report.limitMs !== 100 || report.windowMs !== 150
    || !Number.isInteger(report.planned) || report.planned < 1 || !['passed', 'failed', 'blocked'].includes(report.outcome)
    || !Array.isArray(report.steps) || !report.steps.length || report.steps.length > report.planned) throw new Error('invalid layer report');
  for (const [index, step] of report.steps.entries()) {
    if (!fields(step, ['id', 'key', 'status', 'code', 'expected', 'samples']) || !/^step-[1-9][0-9]*$/.test(step.id)
      || !keys.includes(step.key) || !['passed', 'failed', 'blocked'].includes(step.status)
      || !['OK', 'FOCUS_MISMATCH', 'OBSERVATION_GAP', 'UNSUPPORTED_LAYERS', 'EXPECTATION_TIMEOUT'].includes(step.code)
      || !validState(step.expected) || !Array.isArray(step.samples) || !step.samples.length) throw new Error('invalid layer step');
    if (step.id !== `step-${index + 1}` || (index < report.steps.length - 1 && step.status !== 'passed')) {
      throw new Error('invalid layer sequence');
    }
    let previous = -Infinity;
    for (const sample of step.samples) {
      if (!fields(sample, ['atMs', 'gapMs', 'state']) || !Number.isFinite(sample.atMs) || sample.atMs < 0 || sample.atMs < previous
        || !Number.isFinite(sample.gapMs) || sample.gapMs < 0 || !validState(sample.state)) throw new Error('invalid layer observation');
      if (Number.isFinite(previous) && Math.abs(sample.atMs - previous - sample.gapMs) > 0.001) {
        throw new Error('inconsistent observation interval');
      }
      previous = sample.atMs;
    }
    if (step.status === 'passed' && (step.code !== 'OK' || step.samples.length < 2
      || step.samples.some(sample => sample.gapMs > 100 || sample.state.dialogs > 1 || sample.state.notices > 1 || !matches(sample.state, step.expected))
      || step.samples.at(-1).atMs - step.samples[0].atMs < 150)) throw new Error('unproven layer pass');
    if ((step.status === 'blocked') !== ['OBSERVATION_GAP', 'UNSUPPORTED_LAYERS'].includes(step.code)
      || (step.status === 'failed') !== ['FOCUS_MISMATCH', 'EXPECTATION_TIMEOUT'].includes(step.code)) throw new Error('inconsistent step outcome');
  }
  const allPassed = report.steps.length === report.planned && report.steps.every(step => step.status === 'passed');
  if ((report.outcome === 'passed') !== allPassed || (!allPassed && report.outcome !== report.steps.at(-1).status)) {
    throw new Error('inconsistent report outcome');
  }
  return report;
}

export async function readLayers(page) {
  return page.evaluate(() => {
    const visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const active = document.activeElement;
    const focus = active?.closest('[data-sonner-toaster]') ? 'notice'
      : ['layers-open', 'show-notice', 'layers-close'].includes(active?.id) ? active.id
      : active === document.body || active === document.documentElement ? 'body' : 'unknown';
    return { focus, dialogs: [...document.querySelectorAll('[role=dialog]')].filter(visible).length,
      notices: [...document.querySelectorAll('[data-sonner-toast]:not([data-removed=true])')].filter(visible).length };
  });
}

export const layerSteps = [
  { key: 'Enter', before: { focus: 'layers-open', dialogs: 0, notices: 0 }, after: { focus: 'show-notice', dialogs: 1, notices: 0 } },
  { key: 'Enter', before: { focus: 'show-notice', dialogs: 1, notices: 0 }, after: { focus: 'show-notice', dialogs: 1, notices: 1 } },
  { key: 'Alt+t', before: { focus: 'show-notice', dialogs: 1, notices: 1 }, after: { focus: 'notice', dialogs: 1, notices: 1 } },
  { key: 'Escape', before: { focus: 'notice', dialogs: 1, notices: 1 }, after: { focus: 'show-notice', dialogs: 1, notices: 0 } },
  { key: 'Escape', before: { focus: 'show-notice', dialogs: 1, notices: 0 }, after: { focus: 'layers-open', dialogs: 0, notices: 0 } },
];

export async function runLayers({ read, press }, steps = layerSteps) {
  if (!Array.isArray(steps) || !steps.length || steps.some(step => !fields(step, ['key', 'before', 'after'])
    || !keys.includes(step.key) || !validState(step.before) || !validState(step.after))) throw new Error('invalid layer contract');
  const report = { schema: 'consumer-layers-experiment-1', limitMs: 100, windowMs: 150,
    planned: steps.length, outcome: 'passed', steps: [] };
  const started = performance.now();
  let previous = performance.now();
  const sample = async () => {
    const state = await read(); const now = performance.now(); const gapMs = now - previous; previous = now;
    if (!validState(state)) throw new Error('invalid fixture observation');
    return { atMs: now - started, gapMs, state };
  };
  for (const [index, contract] of steps.entries()) {
    const step = { id: `step-${index + 1}`, key: contract.key, status: 'passed', code: 'OK', expected: contract.before, samples: [] };
    report.steps.push(step);
    const stop = (code, observation) => {
      step.status = ['OBSERVATION_GAP', 'UNSUPPORTED_LAYERS'].includes(code) ? 'blocked' : 'failed';
      step.code = code; step.samples.push(observation); report.outcome = step.status;
      return validateLayerReport(report);
    };
    const before = await sample();
    if (before.gapMs > 100) return stop('OBSERVATION_GAP', before);
    if (before.state.dialogs > 1 || before.state.notices > 1) return stop('UNSUPPORTED_LAYERS', before);
    if (!matches(before.state, contract.before)) return stop('FOCUS_MISMATCH', before);
    await press(contract.key);
    step.expected = contract.after;
    const deadline = performance.now() + 1000;
    let firstMatch;
    while (true) {
      const observation = await sample();
      if (observation.gapMs > 100) return stop('OBSERVATION_GAP', observation);
      if (observation.state.dialogs > 1 || observation.state.notices > 1) return stop('UNSUPPORTED_LAYERS', observation);
      if (matches(observation.state, contract.after)) {
        firstMatch ??= observation.atMs; step.samples.push(observation);
        if (observation.atMs - firstMatch >= 150) break;
      } else if (firstMatch !== undefined) return stop('FOCUS_MISMATCH', observation);
      else if (performance.now() >= deadline) return stop('EXPECTATION_TIMEOUT', observation);
      await delay(Math.max(1, Math.min(40, firstMatch === undefined ? 40 : 150 - (observation.atMs - firstMatch))));
    }
  }
  return validateLayerReport(report);
}
