/**
 * @file install-ai.ts
 * @brief Wires the AI assistant into the editor (main chunk, tiny): the right panel view "AI"
 *        (`[data-right-panel="ai"]` -> `#ai-panel`) loads the AI chunk (ai-panel.ts with the
 *        Anthropic SDK, the tool core and the bridge) the first time it is shown. Nothing AI-related
 *        is downloaded or sent before that.
 */
import { reportLoadFailure } from '../core/load-failure';
import { on } from '../core/event-bus';
import { RIGHT_PANEL_EVENT } from '../scenarios/scenarios-panel';
import type { TabManager } from '../ui/tabs';
import type { AiNotifier, AiPanel } from './ai-panel';

export const AI_PANEL_ID = 'ai-panel';

export function installAi(tabManager: TabManager, notify: AiNotifier): void {
  let panel: Promise<AiPanel> | null = null;
  const show = (): void => {
    const container = document.getElementById(AI_PANEL_ID);
    if (!container) return;
    panel ??= import('./ai-panel').then((m) => m.mountAiPanel(container, { tabManager, notify }));
    panel.then((p) => p.focus()).catch((error: unknown) => {
      panel = null;
      if (!reportLoadFailure('error', 'AI', 'panel failed to load', error)) return;
      notify.error(`AI assistant: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  on(RIGHT_PANEL_EVENT, (detail) => {
    if (detail?.view === 'ai') show();
  });
  if (!document.getElementById(AI_PANEL_ID)?.hidden) show();
}
