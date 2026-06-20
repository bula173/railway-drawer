/**
 * @file connectionManager.ts
 * @brief Handles automatic connections between shapes
 *
 * Features:
 * - Connection point detection
 * - Automatic snapping to connection points
 * - Connection visualization
 * - Smart routing for connections
 */

import type { DrawElement, Point } from '../components/Elements';

/**
 * Connection point on a shape
 */
export interface ConnectionPoint {
  id: string;
  elementId: string;
  position: Point;
  side: 'top' | 'right' | 'bottom' | 'left';
  type: 'input' | 'output' | 'bidirectional';
}

/**
 * A connection between two shapes
 */
export interface Connection {
  id: string;
  fromElementId: string;
  toElementId: string;
  fromPointId: string;
  toPointId: string;
  type: 'direct' | 'junction' | 'crossover';
  label?: string;
}

const SNAP_DISTANCE = 20; // pixels
const CONNECTION_POINT_RADIUS = 6; // pixels

/**
 * Get connection points for a shape based on its type and bounds
 */
export function getConnectionPoints(element: DrawElement): ConnectionPoint[] {
  const points: ConnectionPoint[] = [];
  const { start, end } = element;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  // Top point
  points.push({
    id: `${element.id}-top`,
    elementId: element.id,
    position: { x: centerX, y: start.y },
    side: 'top',
    type: 'bidirectional',
  });

  // Right point
  points.push({
    id: `${element.id}-right`,
    elementId: element.id,
    position: { x: end.x, y: centerY },
    side: 'right',
    type: 'bidirectional',
  });

  // Bottom point
  points.push({
    id: `${element.id}-bottom`,
    elementId: element.id,
    position: { x: centerX, y: end.y },
    side: 'bottom',
    type: 'bidirectional',
  });

  // Left point
  points.push({
    id: `${element.id}-left`,
    elementId: element.id,
    position: { x: start.x, y: centerY },
    side: 'left',
    type: 'bidirectional',
  });

  return points;
}

/**
 * Find the nearest connection point to a given position
 */
export function findNearestConnectionPoint(
  position: Point,
  elements: DrawElement[],
  excludeElementId?: string
): ConnectionPoint | null {
  let nearest: ConnectionPoint | null = null;
  let minDistance = SNAP_DISTANCE;

  for (const element of elements) {
    if (excludeElementId && element.id === excludeElementId) {
      continue;
    }

    const points = getConnectionPoints(element);
    for (const point of points) {
      const dx = point.position.x - position.x;
      const dy = point.position.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }
  }

  return nearest;
}

/**
 * Check if two shapes can be connected
 */
export function canConnect(
  fromElement: DrawElement,
  toElement: DrawElement
): boolean {
  // Can't connect to itself
  if (fromElement.id === toElement.id) {
    return false;
  }

  // Both must be valid shapes
  if (!fromElement.start || !fromElement.end || !toElement.start || !toElement.end) {
    return false;
  }

  return true;
}

/**
 * Create a connection between two shapes
 */
export function createConnection(
  fromElementId: string,
  toElementId: string,
  type: 'direct' | 'junction' | 'crossover' = 'direct'
): Connection {
  return {
    id: `conn-${fromElementId}-${toElementId}-${Date.now()}`,
    fromElementId,
    toElementId,
    fromPointId: `${fromElementId}-right`,
    toPointId: `${toElementId}-left`,
    type,
    label: undefined,
  };
}

/**
 * Get all connection points visible (for rendering)
 */
export function getAllConnectionPoints(elements: DrawElement[]): ConnectionPoint[] {
  const allPoints: ConnectionPoint[] = [];
  for (const element of elements) {
    allPoints.push(...getConnectionPoints(element));
  }
  return allPoints;
}

/**
 * Check if a point is near a connection point
 */
export function isNearConnectionPoint(
  position: Point,
  point: ConnectionPoint
): boolean {
  const dx = point.position.x - position.x;
  const dy = point.position.y - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= SNAP_DISTANCE;
}

/**
 * Snap position to nearest connection point if close enough
 */
export function snapToConnectionPoint(
  position: Point,
  elements: DrawElement[],
  excludeElementId?: string
): Point {
  const nearest = findNearestConnectionPoint(position, elements, excludeElementId);
  if (nearest) {
    return nearest.position;
  }
  return position;
}
