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

import type { DrawElement } from '../components/Elements';

export interface Point {
  x: number;
  y: number;
}

/**
 * @interface ConnectionPoint
 * @brief Represents a connection attachment point on a shape.
 *
 * Connection points are visual targets that allow shapes to snap together
 * when dragging near them. Each shape has 4 points (one on each side).
 *
 * @property {string} id - Unique identifier (format: "${elementId}-${side}")
 * @property {string} elementId - ID of the shape this point belongs to
 * @property {Point} position - World coordinates of the connection point
 * @property {'top'|'right'|'bottom'|'left'} side - Which edge of the shape
 * @property {'input'|'output'|'bidirectional'} type - Directionality of the connection
 */
export interface ConnectionPoint {
  id: string;
  elementId: string;
  position: Point;
  side: 'top' | 'right' | 'bottom' | 'left';
  type: 'input' | 'output' | 'bidirectional';
}

/**
 * @interface Connection
 * @brief Represents a connection between two shapes.
 *
 * Connections define relationships and data flow between shapes.
 * Used for logical organization and can drive automatic layout algorithms.
 *
 * @property {string} id - Unique identifier for the connection
 * @property {string} fromElementId - ID of the source shape
 * @property {string} toElementId - ID of the target shape
 * @property {string} fromPointId - Source connection point ID
 * @property {string} toPointId - Target connection point ID
 * @property {'direct'|'junction'|'crossover'} type - Connection path type
 * @property {string} label - Optional label for the connection
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

/**
 * @function getConnectionPoints
 * @brief Calculates connection points for a shape at the center of each edge.
 *
 * Every shape has exactly 4 connection points, one on each side (top, right, bottom, left).
 * These points are calculated at the edge midpoints of the element's bounding box.
 * Connection points enable automatic snapping when shapes are dragged near each other.
 *
 * @param {DrawElement} element - The shape to calculate connection points for
 * @returns {ConnectionPoint[]} Array of 4 connection points (one per side)
 *
 * @example
 * const points = getConnectionPoints(circleElement);
 * console.log(points.length); // 4
 * console.log(points[0].side); // 'top'
 */
export function getConnectionPoints(element: DrawElement): ConnectionPoint[] {
  const points: ConnectionPoint[] = [];
  const { start, end } = element;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;

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
 * @function findNearestConnectionPoint
 * @brief Finds the closest connection point to a given world position.
 *
 * Searches all connection points on all shapes (except the excluded element)
 * and returns the closest one within the snap distance threshold (20px).
 * Used during drag operations to determine if shapes should snap together.
 *
 * @param {Point} position - World coordinates to search from
 * @param {DrawElement[]} elements - All shapes to search connection points in
 * @param {string} excludeElementId - Optional element ID to skip (usually the dragged shape)
 * @returns {ConnectionPoint | null} Nearest connection point or null if none within snap distance
 *
 * @example
 * const target = findNearestConnectionPoint(
 *   { x: 150, y: 200 },
 *   allElements,
 *   draggedElementId
 * );
 * if (target) {
 *   // Snap the shape to this target point
 * }
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
  // Generate unique ID with timestamp + random component to avoid collisions
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return {
    id: `conn-${fromElementId}-${toElementId}-${Date.now()}-${randomSuffix}`,
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
