/**
 * @file graph-context.ts
 * @brief Graph context providing graph instance and command service
 * @details Minimal context containing only graph-related dependencies
 */

import type { Graph } from '@maxgraph/core';
import type { GraphCommandService } from '../services/graph-command-service';

/**
 * Context for graph operations
 * Replaces TabData.graph + TabData.graphCommandService
 */
export interface GraphContext {
  readonly id: string;
  readonly graph: Graph;
  readonly graphCommandService: GraphCommandService;
}

/**
 * Create a graph context
 */
export function createGraphContext(
  id: string,
  graph: Graph,
  graphCommandService: GraphCommandService
): GraphContext {
  return {
    id,
    graph,
    graphCommandService,
  };
}

/**
 * Hook to access graph context (placeholder for future implementation)
 * Usage: const ctx = useGraphContext(tabId)
 * Note: This would be implemented in a context provider
 */
export function useGraphContext(_tabId: string): GraphContext | undefined {
  // Placeholder - would be implemented in context provider
  return undefined;
}
