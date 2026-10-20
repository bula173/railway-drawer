import { Graph } from '@maxgraph/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStartCard, isDiagramEmpty, START_CARD_HIDDEN_KEY } from '../../ui/start-card';

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

function setup() {
  const container = document.body.appendChild(document.createElement('div'));
  const graph = new Graph(document.body.appendChild(document.createElement('div')));
  const onAction = vi.fn();
  const card = createStartCard({ container, getActive: () => ({ id: 't1', graph }), onAction });
  return { graph, card, onAction };
}

describe('start card', () => {
  it('shows on an empty diagram and goes away on the first insert', () => {
    const { graph, card } = setup();
    expect(isDiagramEmpty(graph)).toBe(true);
    expect(card.element.hidden).toBe(false);
    graph.insertVertex(graph.getDefaultParent(), null, '', 0, 0, 10, 10);
    expect(card.element.hidden).toBe(true);
    card.update();
    expect(card.element.hidden).toBe(true);
    card.destroy();
  });

  it('runs an action and dismisses; Esc dismisses', () => {
    const { card, onAction } = setup();
    card.element.querySelector<HTMLButtonElement>('[data-start-action="ertms"]')!.click();
    expect(onAction).toHaveBeenCalledWith('ertms');
    expect(card.element.hidden).toBe(true);
    card.destroy();
    const second = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(second.card.element.hidden).toBe(true);
    second.card.destroy();
  });

  it("\"Don't show again\" is remembered", () => {
    const { card } = setup();
    card.element.querySelector<HTMLButtonElement>('.rd-start-never')!.click();
    expect(card.element.hidden).toBe(true);
    expect(localStorage.getItem(START_CARD_HIDDEN_KEY)).toBe('1');
    card.destroy();
    expect(setup().card.element.hidden).toBe(true);
  });

  it('hides while something is dragged', () => {
    const { card } = setup();
    document.dispatchEvent(new Event('dragenter'));
    expect(card.element.classList.contains('rd-start-dragging')).toBe(true);
    document.dispatchEvent(new Event('drop'));
    expect(card.element.classList.contains('rd-start-dragging')).toBe(false);
    card.destroy();
  });
});
