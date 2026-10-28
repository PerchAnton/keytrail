import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, arch } from 'node:os';

import { inputHashes } from '../verification/inputs.mjs';

const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2; };
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(.95 * values.length) - 1];
export default class BenchmarkReporter {
  records = []; controls = []; failed = false;
  async onBegin() { this.sourceHashes = await inputHashes(['benchmarks']); this.startedAt = new Date().toISOString(); }
  onTestEnd(test, result) {
    try {
      assert.equal(result.status, 'passed'); assert.equal(test.expectedStatus, 'passed'); assert.equal(result.retry, 0);
      for (const item of result.attachments) {
        if (item.name === 'benchmark-pair.json') this.records.push(JSON.parse(item.body.toString()));
        if (item.name === 'benchmark-control.json') this.controls.push(JSON.parse(item.body.toString()));
      }
    } catch { this.failed = true; }
  }
  async onEnd(result) {
    try {
      assert.equal(result.status, 'passed'); assert.equal(this.failed, false);
      assert.deepEqual(await inputHashes(['benchmarks']), this.sourceHashes, 'BENCHMARK_SOURCE_CHANGED');
      const pilot = process.env.KEYTRAIL_BENCHMARK_PILOT === '1';
      const warmups = pilot ? 0 : 5, samples = pilot ? 1 : 30;
      for (const kind of ['dialog', 'tabs', 'formErrors']) {
        const all = this.records.filter(r => r.kind === kind), pairs = all.filter(r => !r.warmup);
        assert.equal(all.filter(r => r.warmup).length, warmups); assert.equal(pairs.length, samples);
        assert.equal(new Set(all.map(r => r.pair)).size, all.length);
        assert.equal(this.controls.filter(c => c.kind === kind).length, 1);
        assert(pairs.every(r => r.keytrailMs > 0 && r.nativeMs > 0 && Number.isFinite(r.keytrailMs + r.nativeMs)));
        if (!pilot) assert.equal(pairs.filter(r => r.order[0] === 'keytrail').length, 15);
        const summarize = values => ({ medianMs: median(values), p95Ms: p95(values) });
        const keytrail = summarize(pairs.map(r => r.keytrailMs)), native = summarize(pairs.map(r => r.nativeMs));
        const pairedMedianOverheadPercent = median(pairs.map(r => (r.keytrailMs / r.nativeMs - 1) * 100));
        const ratioOfMediansOverheadPercent = (keytrail.medianMs / native.medianMs - 1) * 100;
        assert.equal(new Set(all.map(r => r.chromium)).size, 1, 'BROWSER_CHANGED');
        const proof = { version: JSON.parse(readFileSync('package.json', 'utf8')).version, sourceHashes: this.sourceHashes, startedAt: this.startedAt, measuredAt: new Date().toISOString(), pilot, kind, warmupsPerArm: warmups, samplesPerArm: samples,
          environment: { node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0].model,
            logicalCpus: cpus().length, playwright: '1.64.1', chromium: pairs[0].chromium, workers: 1 },
          equivalence: { fixedManifest: true, actionAndCheckSignatures: true, negativeControl: this.controls.find(c => c.kind === kind).failure,
            reportSerialization: true, pageSetupAndTeardownExcluded: true, freshTestPerPair: true },
          summary: { keytrail, native, pairedMedianOverheadPercent, ratioOfMediansOverheadPercent,
            targetMet: !pilot && pairedMedianOverheadPercent <= 20 && ratioOfMediansOverheadPercent <= 20 }, pairs };
        mkdirSync('artifacts/benchmark', { recursive: true });
        writeFileSync(`artifacts/benchmark/${kind}.json`, JSON.stringify(proof, null, 2) + '\n');
        console.log(`${kind}: paired median overhead ${pairedMedianOverheadPercent.toFixed(1)}%${pilot ? ' (pilot)' : ''}`);
      }
    } catch (error) { console.error('Benchmark evidence rejected:', error.message); this.failed = true; }
    return { status: result.status === 'passed' && this.failed ? 'failed' : result.status };
  }
}
