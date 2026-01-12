import type { Point, DrawElement } from '../types';

/**
 * @function findSnapPoint
 * @brief Finds the nearest endpoint from other line-based elements
 * @param point Current point to check from
 * @param elements All drawing elements
 * @param excludeElementId ID of the element currently being moved/resized
 * @param threshold Snap distance threshold
 * @returns Snapped point if found, otherwise original point
 */
export function findSnapPoint(
  point: Point,
  elements: DrawElement[],
  excludeElementId: string | null = null,
  threshold: number = 20
): Point & { snapped: boolean; snappedTo?: string } {
  let nearestPoint: Point = { ...point };
  let minDistance = threshold;
  let snapped = false;
  let snappedTo: string | undefined = undefined;

  for (const el of elements) {
    if (el.id === excludeElementId || !el.isLineBased) continue;

    const endpoints = [el.start, el.end];
    for (const ep of endpoints) {
      const dx = point.x - ep.x;
      const dy = point.y - ep.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = { ...ep };
        snapped = true;
        snappedTo = el.id;
      }
    }
  }

  return { ...nearestPoint, snapped, snappedTo };
}
