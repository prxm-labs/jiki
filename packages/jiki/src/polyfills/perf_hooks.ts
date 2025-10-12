export const performance = globalThis.performance;

export class PerformanceObserver {
  private callback: (list: unknown) => void;
  constructor(callback: (list: unknown) => void) {
    this.callback = callback;
  }
  observe(_options?: unknown): void {}
  disconnect(): void {}
}

export function monitorEventLoopDelay(_options?: unknown): {
  enable(): void;
  disable(): void;
  min: number;
  max: number;
  mean: number;
  percentile(p: number): number;
} {
  return {
    enable() {},
    disable() {},
    min: 0,
    max: 0,
    mean: 0,
    percentile: () => 0,
  };
}

export default { performance, PerformanceObserver, monitorEventLoopDelay };
