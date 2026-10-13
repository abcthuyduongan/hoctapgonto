/** Timestamp samples exclude pauses; P95 describes frame duration, not FPS. */
export class PerformanceMetrics {
  private durations: number[] = [];
  private last = 0;
  frames = 0;
  resetClock() { this.last = 0; }
  record(now: number) {
    const duration = now - this.last;
    if (this.last && duration > 0 && duration < 1000) {
      this.durations.push(duration);
      if (this.durations.length > 180) this.durations.shift();
      this.frames++;
    }
    this.last = now;
  }
  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    if (!sorted.length) return { frames: this.frames };
    const median = sorted[Math.floor(sorted.length / 2)];
    return { frames: this.frames, fpsMedian: Math.round(10000 / median) / 10,
      fpsP95FrameMs: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] };
  }
}
