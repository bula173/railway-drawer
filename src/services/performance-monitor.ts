/**
 * @file performance-monitor.ts
 * @brief Performance monitoring and optimization
 * @details Phase 10 - Performance tracking and metrics
 */

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  operationCount: number;
  errorCount: number;
  averageOperationTime: number;
}

/**
 * Operation performance tracking
 */
export class PerformanceMonitor {
  private operations: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    memoryUsage: 0,
    operationCount: 0,
    errorCount: 0,
    averageOperationTime: 0,
  };

  /**
   * Start measuring an operation
   */
  startOperation(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End measuring an operation
   */
  endOperation(name: string): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      console.warn(`[Performance] No start time for operation: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(name);

    if (!this.operations.has(name)) {
      this.operations.set(name, []);
    }
    this.operations.get(name)!.push(duration);

    this.metrics.operationCount++;
    this.updateAverageTime();

    return duration;
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(name: string, fn: () => T): T {
    this.startOperation(name);
    try {
      return fn();
    } finally {
      this.endOperation(name);
    }
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startOperation(name);
    try {
      return await fn();
    } finally {
      this.endOperation(name);
    }
  }

  /**
   * Get operation statistics
   */
  getOperationStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const times = this.operations.get(name);
    if (!times || times.length === 0) return null;

    return {
      count: times.length,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.operations.clear();
    this.startTimes.clear();
    this.metrics = {
      renderTime: 0,
      memoryUsage: 0,
      operationCount: 0,
      errorCount: 0,
      averageOperationTime: 0,
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1048576; // MB
    }
    return 0;
  }

  /**
   * Update average operation time
   */
  private updateAverageTime(): void {
    let totalTime = 0;
    let operationCount = 0;

    this.operations.forEach((times) => {
      totalTime += times.reduce((a, b) => a + b, 0);
      operationCount += times.length;
    });

    this.metrics.averageOperationTime =
      operationCount > 0 ? totalTime / operationCount : 0;
  }

  /**
   * Report performance metrics
   */
  report(): void {
    console.log('[Performance Report]');
    console.log('Total Operations:', this.metrics.operationCount);
    console.log('Average Operation Time:', `${this.metrics.averageOperationTime.toFixed(2)}ms`);
    console.log('Memory Usage:', `${this.getMemoryUsage().toFixed(2)}MB`);

    const stats = new Map<string, { count: number; avg: number }>();
    this.operations.forEach((times, name) => {
      stats.set(name, {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
      });
    });

    // Sort by count
    const sorted = Array.from(stats.entries()).sort((a, b) => b[1].count - a[1].count);
    console.table(
      sorted.map(([name, stat]) => ({
        operation: name,
        count: stat.count,
        avgTime: `${stat.avg.toFixed(2)}ms`,
      }))
    );
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor();
