/**
 * @file shape-registration-error-handler.ts
 * @brief Safe shape registration with comprehensive error handling
 * @details Ensures app continues working even if some shapes fail to register
 */

import { ServiceRegistry } from '../services/service-registry';

/**
 * Shape registration result tracking
 */
export interface ShapeRegistrationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    shapeName: string;
    category: string;
    error: string;
  }>;
}

/**
 * Safely register a shape with error handling
 */
export function safeRegisterShape(
  category: string,
  shapeName: string,
  registerFn: () => void
): boolean {
  try {
    registerFn();
    return true;
  } catch (error) {
    const errorHandler = ServiceRegistry.get<any>('errorHandler');
    const message = error instanceof Error ? error.message : String(error);

    if (errorHandler) {
      errorHandler.handleShapeError(
        `Failed to register shape "${shapeName}" in ${category}: ${message}`,
        true
      );
    } else {
      console.warn(`[Shape Registration] ${message}`);
    }

    return false;
  }
}

/**
 * Track shape registration with detailed logging
 */
export class ShapeRegistrationTracker {
  private results: ShapeRegistrationResult = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  register(category: string, shapeName: string, registerFn: () => void): void {
    this.results.total++;

    if (safeRegisterShape(category, shapeName, registerFn)) {
      this.results.successful++;
    } else {
      this.results.failed++;
      this.results.errors.push({
        shapeName,
        category,
        error: `Failed to register`,
      });
    }
  }

  getResults(): ShapeRegistrationResult {
    return { ...this.results };
  }

  report(): void {
    console.log('[Shape Registration Report]');
    console.log(`  Total: ${this.results.total}`);
    console.log(`  Successful: ${this.results.successful}`);
    console.log(`  Failed: ${this.results.failed}`);

    if (this.results.failed > 0) {
      console.warn('  Failed shapes:', this.results.errors);
    }

    const successRate = ((this.results.successful / this.results.total) * 100).toFixed(1);
    console.log(`  Success rate: ${successRate}%`);
  }
}

/**
 * Validate a shape configuration
 */
export function validateShapeConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Missing shape name');
  }

  if (!config.group) {
    errors.push('Missing shape group');
  }

  if (!config.type || !['vertex', 'svg'].includes(config.type)) {
    errors.push(`Invalid shape type: ${config.type}`);
  }

  if (config.width && (typeof config.width !== 'number' || config.width <= 0)) {
    errors.push(`Invalid width: ${config.width}`);
  }

  if (config.height && (typeof config.height !== 'number' || config.height <= 0)) {
    errors.push(`Invalid height: ${config.height}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Wrap shape registration function with error recovery
 */
export function withErrorRecovery(
  category: string,
  registerFn: (tracker: ShapeRegistrationTracker) => void
): ShapeRegistrationResult {
  const tracker = new ShapeRegistrationTracker();

  try {
    registerFn(tracker);
  } catch (error) {
    const errorHandler = ServiceRegistry.get<any>('errorHandler');
    if (errorHandler) {
      errorHandler.handleShapeError(
        `Failed to register shape category "${category}": ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }

  return tracker.getResults();
}
