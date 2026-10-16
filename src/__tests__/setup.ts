/**
 * @file setup.ts
 * @brief Test setup and utilities
 */

import { Graph } from '@maxgraph/core';

/**
 * Create a test graph instance
 */
export function createTestGraph(): Graph {
  const container = document.createElement('div');
  const graph = new Graph(container);

  // Configure graph for testing
  graph.cellsMovable = true;
  graph.cellsResizable = true;
  graph.cellsEditable = true;
  graph.cellsSelectable = true;
  graph.setConnectable(true);
  graph.dropEnabled = true;
  graph.setMultigraph(false);

  return graph;
}

/**
 * Cleanup test graph
 */
export function cleanupTestGraph(graph: Graph): void {
  if (graph) {
    graph.destroy();
  }
}

/**
 * Create test DOM container
 */
export function createTestContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = `test-container-${Math.random().toString(36).substr(2, 9)}`;
  document.body.appendChild(container);
  return container;
}

/**
 * Cleanup test container
 */
export function cleanupTestContainer(container: HTMLElement): void {
  if (container && container.parentElement) {
    container.parentElement.removeChild(container);
  }
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Setup DOM environment for tests
 */
export function setupDOM(): void {
  // Ensure we have a document
  if (typeof document === 'undefined') {
    throw new Error('Tests require DOM environment');
  }
}

/**
 * Teardown DOM environment
 */
export function teardownDOM(): void {
  // Clear all test containers
  const containers = document.querySelectorAll('[id^="test-container-"]');
  containers.forEach((container) => container.remove());
}
