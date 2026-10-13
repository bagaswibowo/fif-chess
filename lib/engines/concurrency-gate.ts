/**
 * Concurrency gate & adaptive load shedding for MCTS runs.
 * Limits simultaneous CPU-heavy simulations to MAX_CONCURRENT_MCTS (4).
 * If queued requests > 5, sheds load by reducing default simulations to 10-12.
 */

export const MAX_CONCURRENT_MCTS = 4;
export const SHED_QUEUE_THRESHOLD = 5;
export const SHED_SIMULATIONS = 10;
export const DEFAULT_SIMULATIONS = 15;

class ConcurrencyGate {
  private active = 0;
  private queue: Array<() => void> = [];

  get activeCount(): number {
    return this.active;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Adaptive load shedding: if queue > 5, shed load by reducing simulations to 10-12
   * (returns 10 when shedding, or clamps requested default).
   */
  getAdaptiveSimulations(requested?: number): number {
    if (this.queue.length > SHED_QUEUE_THRESHOLD) {
      // ponytail: queue > 5 drops to 10 sims; bump or dynamic curve if latency needs tuning
      return Math.min(requested ?? SHED_SIMULATIONS, SHED_SIMULATIONS);
    }
    return requested ?? DEFAULT_SIMULATIONS;
  }

  async acquire(): Promise<() => void> {
    if (this.active < MAX_CONCURRENT_MCTS) {
      this.active++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.active = Math.max(0, this.active - 1);
    }
  }

  /**
   * Helper to run an async operation within the concurrency gate
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// Global singleton for the nodejs server process
export const mctsConcurrencyGate = new ConcurrencyGate();
