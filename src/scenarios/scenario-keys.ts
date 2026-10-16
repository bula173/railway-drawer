/**
 * @file scenario-keys.ts
 * @brief Keyboard handling while the scenario view is shown (called from the single keydown
 *        dispatcher in legacy-main.ts, before the graph shortcuts).
 *
 * The live drawing is hidden but its tab is still active, so no graph shortcut may reach it:
 * editing shortcuts are blocked, the arrows/PageUp/PageDown/Home/End step through the scenario,
 * Escape returns to editing. Keys typed into fields (dialogs, inputs) are left alone; outside the
 * scenario view the dispatcher never calls this, so the arrows keep their usual meaning.
 */

export type ScenarioKeyAction = 'prev' | 'next' | 'first' | 'last' | 'exit' | 'block' | 'swallow' | 'pass';

const EDIT_KEYS = new Set(['z', 'y', 'x', 'v', 'a', 'c', 'd', 'g', 'b', 'i', 'u', 'l', 'Delete', 'Backspace', 'Enter']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * What a keydown means in the scenario view:
 * - prev/next/first/last/exit: navigation (the caller prevents the default and stops the event);
 * - block: an editing shortcut of the hidden drawing (Ctrl+Z/Y/X/V/A/C/D/G, Delete, ...): prevent + stop;
 * - swallow: any other key: stopped so no per-tab shortcut acts on the hidden drawing, default kept
 *   (Tab focus, Enter/Space on a focused button);
 * - pass: typing in a field, IME composition, Ctrl/Cmd+S (save works as usual).
 */
export function scenarioKeyAction(e: KeyboardEvent): ScenarioKeyAction {
  if (e.isComposing || isEditableTarget(e.target)) return 'pass';
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && key === 's') return 'pass';
  // Editing shortcuts of the app (undo/redo, clipboard, select all, duplicate, group, ...);
  // other combinations (Ctrl+R, Ctrl+T, ...) keep the browser's behaviour
  if (mod) return EDIT_KEYS.has(key) ? 'block' : 'swallow';
  if (e.altKey) return 'swallow';
  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev';
    case 'ArrowRight':
    case 'PageDown':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Escape':
      return 'exit';
    case 'Delete':
    case 'Backspace':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'F2':
      return 'block';
    default:
      return 'swallow';
  }
}
