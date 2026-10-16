/**
 * @file contexts/index.ts
 * @brief Export all context types and factories
 * @details Replaces monolithic TabData with focused contexts
 */

import type { GraphContext } from './graph-context';
import type { UIContext } from './ui-context';
import type { EditingContext } from './editing-context';
import type { HelpersContext } from './helpers-context';
import type { FeaturesContext } from './features-context';

export type { GraphContext } from './graph-context';
export { createGraphContext } from './graph-context';

export type { UIContext, UIState } from './ui-context';
export { createUIContext, createInitialUIState } from './ui-context';

export type { EditingContext, EditingState, EditingMode } from './editing-context';
export { createEditingContext, createInitialEditingState } from './editing-context';

export type { HelpersContext } from './helpers-context';
export { createHelpersContext } from './helpers-context';

export type { FeaturesContext } from './features-context';
export { createFeaturesContext, hasFeature } from './features-context';

/**
 * Complete tab context combining all focused contexts
 * This replaces the monolithic TabData interface
 */
export interface TabContext {
  readonly id: string;
  readonly name: string;
  readonly graph: GraphContext;
  readonly ui: UIContext;
  readonly editing: EditingContext;
  readonly helpers: HelpersContext;
  readonly features: FeaturesContext;
}

/**
 * Factory function to create complete tab context
 */
export function createTabContext(
  id: string,
  name: string,
  graph: GraphContext,
  ui: UIContext,
  editing: EditingContext,
  helpers: HelpersContext,
  features: FeaturesContext
): TabContext {
  return {
    id,
    name,
    graph,
    ui,
    editing,
    helpers,
    features,
  };
}
