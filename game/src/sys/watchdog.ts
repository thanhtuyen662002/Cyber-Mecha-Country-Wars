// 24/7 self-healing (PLAN.md "Chịu được sự cố"):
//  - frame stall > 5 s (tab frozen, GPU hang recovered) -> reload
//  - WebGL context lost -> reload
//  - error storm (> 20 uncaught errors / minute) -> reload
//  - JS heap above a threshold -> reload at the next safe moment
//  - scheduled refresh every N hours, only at a safe moment (victory screen)
// The game state is saved first, so a reload resumes the same round.

export interface WatchdogOpts {
  saveNow: () => Promise<void>;
  canvas: HTMLCanvasElement;
  refreshHours: number;
  heapLimitMB: number;
}

export class Watchdog {
  private lastFrame = performance.now();
  private errors: number[] = [];
  private started = performance.now();
  private reloading = false;
  reason = '';
  /** Set by offline tools (poster export) that block the main loop on purpose. */
  paused = false;

  constructor(private o: WatchdogOpts) {
    o.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.reload('webgl-context-lost');
    });
    window.addEventListener('error', () => this.onError());
    window.addEventListener('unhandledrejection', () => this.onError());
    // A timer keeps running even if rAF stops (rAF is throttled when hidden, so only act when visible).
    window.setInterval(() => {
      if (!this.paused && document.visibilityState === 'visible' && performance.now() - this.lastFrame > 5000) this.reload('frame-stall');
    }, 1000);
  }

  private onError() {
    const now = performance.now();
    this.errors.push(now);
    this.errors = this.errors.filter((t) => now - t < 60000);
    if (this.errors.length > 20) this.reload('error-storm');
  }

  /** Call every frame. */
  frame() {
    this.lastFrame = performance.now();
  }

  heapMB() {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? m.usedJSHeapSize / 1048576 : 0;
  }

  /** True when a planned refresh is due (call at a safe moment, e.g. the victory screen). */
  dueForRefresh() {
    const hours = (performance.now() - this.started) / 3600000;
    return hours >= this.o.refreshHours || this.heapMB() > this.o.heapLimitMB;
  }

  async reload(reason: string) {
    if (this.reloading) return;
    this.reloading = true;
    this.reason = reason;
    console.warn('[watchdog] reloading:', reason);
    try {
      await Promise.race([this.o.saveNow(), new Promise((r) => setTimeout(r, 1500))]);
    } finally {
      location.reload();
    }
  }
}
