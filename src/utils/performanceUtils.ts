/**
 * Performance utility functions for optimizing React renders and calculations
 */

import type { DrawElement } from '../components/Elements';

/**
 * Calculate alignment guides efficiently
 * Only recompute when elements actually change
 */
export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  color: string;
}

export const detectAlignmentGuides = (
  activeElement: DrawElement,
  allElements: DrawElement[],
  selectedIds: string[]
): AlignmentGuide[] => {
  const guides: AlignmentGuide[] = [];
  const threshold = 10; // pixels within which to snap
  const color = 'rgba(255, 0, 0, 0.5)';

  if (!activeElement) return guides;

  const activeStart = activeElement.start.x;
  const activeEnd = activeElement.end.x;
  const activeTop = activeElement.start.y;
  const activeBottom = activeElement.end.y;

  // Only check against non-selected elements for performance
  const otherElements = allElements.filter(
    el => !selectedIds.includes(el.id) && el.id !== activeElement.id
  );

  otherElements.forEach(el => {
    const elStart = el.start.x;
    const elEnd = el.end.x;
    const elTop = el.start.y;
    const elBottom = el.end.y;

    // Vertical alignment guides
    if (Math.abs(activeStart - elEnd) < threshold) {
      guides.push({ type: 'vertical', position: elEnd, color });
    }
    if (Math.abs(activeEnd - elStart) < threshold) {
      guides.push({ type: 'vertical', position: elStart, color });
    }
    if (Math.abs(activeStart - elStart) < threshold) {
      guides.push({ type: 'vertical', position: elStart, color });
    }

    // Horizontal alignment guides
    if (Math.abs(activeTop - elBottom) < threshold) {
      guides.push({ type: 'horizontal', position: elBottom, color });
    }
    if (Math.abs(activeBottom - elTop) < threshold) {
      guides.push({ type: 'horizontal', position: elTop, color });
    }
    if (Math.abs(activeTop - elTop) < threshold) {
      guides.push({ type: 'horizontal', position: elTop, color });
    }
  });

  return guides;
};

/**
 * Create a shallow copy of elements for snapshots
 * More efficient than deep copying all properties
 */
export const createElementSnapshot = (elements: DrawElement[]): DrawElement[] => {
  return elements.map(el => ({
    id: el.id,
    type: el.type,
    start: { x: el.start.x, y: el.start.y },
    end: { x: el.end.x, y: el.end.y },
    rotation: el.rotation,
    mirrorX: el.mirrorX,
    mirrorY: el.mirrorY,
    fillColor: el.fillColor,
    strokeColor: el.strokeColor,
    strokeWidth: el.strokeWidth,
    opacity: el.opacity,
    label: el.label,
  } as DrawElement));
};

/**
 * Compare two element snapshots to detect actual changes
 */
export const hasElementsChanged = (
  previous: DrawElement[] | undefined,
  current: DrawElement[]
): boolean => {
  if (!previous) return true;
  if (previous.length !== current.length) return true;

  for (let i = 0; i < previous.length; i++) {
    const prev = previous[i];
    const curr = current[i];

    if (
      prev.id !== curr.id ||
      prev.type !== curr.type ||
      prev.start.x !== curr.start.x ||
      prev.start.y !== curr.start.y ||
      prev.end.x !== curr.end.x ||
      prev.end.y !== curr.end.y ||
      prev.rotation !== curr.rotation ||
      prev.fillColor !== curr.fillColor ||
      prev.strokeColor !== curr.strokeColor ||
      prev.label !== curr.label
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Debounce history snapshots to avoid capturing intermediate states
 */
export const debounceHistoryCapture = (
  callback: () => void,
  delayMs: number = 500
): (() => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(callback, delayMs);
  };
};

/**
 * Limit history array to maximum size
 */
export const pruneHistory = <T,>(history: T[], maxSize: number = 50): T[] => {
  if (history.length <= maxSize) return history;
  return history.slice(-maxSize);
};
