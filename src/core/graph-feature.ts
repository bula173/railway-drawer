/**
 * @file graph-feature.ts
 * @brief Lazy per-graph features (installed on a changing set of graphs, e.g. the open tabs).
 *
 * Used by feature modules that add behaviour to the tab graphs after boot (railway snap to track,
 * reverse points fade) instead of hand-written "installed" maps. See ui/setup-graph.ts for the
 * graph setup itself.
 */
import type { Graph } from '@maxgraph/core';

/** A per-graph feature installed lazily on a changing set of graphs (the open tabs). */
export interface GraphFeature {
  /** Installs the feature on graphs that lack it and uninstalls it from graphs no longer listed. */
  sync(graphs: Iterable<Graph>): void;
  /** Whether the feature is installed on `graph`. */
  has(graph: Graph): boolean;
  /** Uninstalls the feature from every graph. */
  dispose(): void;
}

/** One reconciler for the lazy per-graph features (railway snap to track, points fade). */
export function createGraphFeature(name: string, install: (graph: Graph) => () => void): GraphFeature {
  const installed = new Map<Graph, () => void>();
  const uninstall = (graph: Graph): void => {
    const off = installed.get(graph);
    installed.delete(graph);
    try {
      off?.();
    } catch (e) {
      console.warn(`[graph feature ${name}] uninstall failed:`, e);
    }
  };
  return {
    sync(graphs) {
      const live = new Set(graphs);
      for (const g of live) if (!installed.has(g)) installed.set(g, install(g));
      for (const g of [...installed.keys()]) if (!live.has(g)) uninstall(g);
    },
    has: (graph) => installed.has(graph),
    dispose() {
      for (const g of [...installed.keys()]) uninstall(g);
    },
  };
}
