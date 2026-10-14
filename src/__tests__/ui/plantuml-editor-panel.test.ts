/**
 * Regression: every tab's PlantUmlEditorController rebuilt the shared #plantuml-panel, discarding
 * the buttons the other tabs' listeners were bound to, and destroy() removed nothing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import { PlantUmlEditorController } from '../../ui/plantuml-editor';
import { createTestGraph, cleanupTestGraph } from '../setup';

describe('PlantUmlEditorController shared panel', () => {
  let graphs: Graph[];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = '<div id="plantuml-panel"></div>';
    graphs = [createTestGraph(), createTestGraph()];
  });

  afterEach(() => {
    graphs.forEach(cleanupTestGraph);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('builds the panel once and removes only its own listeners on destroy', () => {
    const first = new PlantUmlEditorController(graphs[0]);
    const renderButton = document.getElementById('render-plantuml-btn');
    const second = new PlantUmlEditorController(graphs[1]);

    expect(document.querySelectorAll('#plantuml-input')).toHaveLength(1);
    expect(document.getElementById('render-plantuml-btn')).toBe(renderButton);

    const textarea = document.getElementById('plantuml-input') as HTMLTextAreaElement;
    const clearFirst = vi.spyOn(first as unknown as { clearEditor(): void }, 'clearEditor');
    const clearSecond = vi.spyOn(second as unknown as { clearEditor(): void }, 'clearEditor');
    const clearButton = document.getElementById('clear-plantuml-btn')!;

    first.destroy();
    textarea.value = 'x';
    clearButton.click();

    // Handlers call this.clearEditor() at event time, so the spies see which tab handled it
    expect(textarea.value).toBe('');
    expect(clearFirst).not.toHaveBeenCalled();
    expect(clearSecond).toHaveBeenCalledTimes(1);
    expect(document.getElementById('plantuml-input')).toBe(textarea);

    second.destroy();
    textarea.value = 'y';
    clearButton.click();
    expect(textarea.value).toBe('y');
  });
});
