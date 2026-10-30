import type { SafeObservation } from '../contracts/types.js';

export const MAX_OBSERVATION_GAP_MS = 100;
/** Target a quarter of the gap budget; leave room for variable browser transport. */
export function observationPauseMs(readDurationMs: number): number {
  return Math.max(1, Math.min(10, MAX_OBSERVATION_GAP_MS / 4 - readDurationMs));
}
/** Timestamps come from the same browser clock at the start of each DOM snapshot. */
export class ObservationWindow {
  private first: number | undefined;
  private last: number | undefined;
  private readonly intervals: number[] = [];
  private maximum = 0;
  add(at: number): void {
    if (!Number.isFinite(at) || at < 0) throw new Error('INVALID_OBSERVATION_CLOCK');
    if (this.last !== undefined) {
      const interval = at - this.last;
      if (!Number.isFinite(interval) || interval < 0) throw new Error('INVALID_OBSERVATION_CLOCK');
      this.intervals.push(interval);
      this.maximum = Math.max(this.maximum, interval);
    }
    this.first ??= at;
    this.last = at;
  }
  get elapsed(): number { return this.last === undefined ? 0 : this.last - this.first!; }
  get gap(): boolean { return this.maximum > MAX_OBSERVATION_GAP_MS; }
  complete(duration: number): boolean { return this.intervals.length > 0 && this.elapsed >= duration && !this.gap; }
  observed(): SafeObservation {
    if (this.last === undefined) return {};
    return { observationWindowMs: this.elapsed, observationCount: this.last === undefined ? 0 : this.intervals.length + 1,
      observationIntervalsMs: [...this.intervals], maxObservationGapMs: this.maximum };
  }
}
