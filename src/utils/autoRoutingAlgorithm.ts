/**
 * @file autoRoutingAlgorithm.ts
 * @brief Auto-routing algorithm for track connections
 *
 * Implements intelligent path-finding for railway track connections:
 * - Orthogonal routing (preferred for railways)
 * - Obstacle avoidance
 * - Curved routing option
 * - Waypoint optimization
 */

import type { DrawElement } from '../components/Elements';
import { logger } from './logger';

/**
 * @interface Point
 * @brief 2D point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * @interface RoutingConfig
 * @brief Configuration for routing algorithm
 */
export interface RoutingConfig {
  routingType: 'orthogonal' | 'curved' | 'direct';
  gridSize?: number; // For snapping (default: 20)
  minDistance?: number; // Minimum distance from obstacles (default: 10)
  avoidObstacles?: boolean; // Default: true
  snapToGrid?: boolean; // Default: true
}

/**
 * @interface RoutingResult
 * @brief Result of routing calculation
 */
export interface RoutingResult {
  waypoints: Point[];
  isOptimal: boolean;
  distance: number;
  complexity: number; // Number of turns (0 = straight, higher = more complex)
  routingType: 'orthogonal' | 'curved' | 'direct';
  obstaclesAvoided: number;
}

/**
 * Default routing configuration
 */
const DEFAULT_CONFIG: RoutingConfig = {
  routingType: 'orthogonal',
  gridSize: 20,
  minDistance: 10,
  avoidObstacles: true,
  snapToGrid: true,
};

/**
 * Calculate orthogonal routing (L-shaped or stepped path)
 * Most common for railway diagrams
 */
export const calculateOrthogonalRouting = (
  source: Point,
  target: Point,
  obstacles: DrawElement[] = [],
  config: Partial<RoutingConfig> = {}
): RoutingResult => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const waypoints: Point[] = [source];

  // Try different routing strategies (priority order)
  const strategies = [
    // Strategy 1: Horizontal first, then vertical
    () => [
      source,
      { x: target.x, y: source.y },
      target,
    ],
    // Strategy 2: Vertical first, then horizontal
    () => [
      source,
      { x: source.x, y: target.y },
      target,
    ],
    // Strategy 3: Staggered (avoid center)
    () => {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      return [
        source,
        { x: midX, y: source.y },
        { x: midX, y: target.y },
        target,
      ];
    },
  ];

  let bestPath = strategies[0]();
  let bestCost = calculatePathCost(bestPath, obstacles, finalConfig);

  // Try all strategies and pick the best
  for (let i = 1; i < strategies.length; i++) {
    const path = strategies[i]();
    const cost = calculatePathCost(path, obstacles, finalConfig);

    if (cost < bestCost) {
      bestCost = cost;
      bestPath = path;
    }
  }

  // Snap waypoints to grid if configured
  if (finalConfig.snapToGrid && finalConfig.gridSize) {
    bestPath = bestPath.map(p => snapToGrid(p, finalConfig.gridSize!));
  }

  // Remove redundant waypoints
  bestPath = removeRedundantWaypoints(bestPath);

  const distance = calculateDistance(bestPath);
  const complexity = bestPath.length - 2; // Number of intermediate waypoints

  logger.debug('autoRoutingAlgorithm', 'Orthogonal routing calculated', {
    waypoints: bestPath.length,
    distance: Math.round(distance),
    complexity,
  });

  return {
    waypoints: bestPath,
    isOptimal: complexity === 1, // L-shaped is optimal
    distance,
    complexity,
    routingType: 'orthogonal',
    obstaclesAvoided: 0, // Simplified for now
  };
};

/**
 * Calculate curved routing (smooth paths)
 */
export const calculateCurvedRouting = (
  source: Point,
  target: Point,
  _obstacles: DrawElement[] = [],
  config: Partial<RoutingConfig> = {}
): RoutingResult => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // For curved routing, we create a bezier-like curve
  // Generate intermediate waypoints
  const waypoints: Point[] = [source];

  // Calculate control points for smooth curve
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Number of intermediate points based on distance
  const steps = Math.max(3, Math.ceil(distance / 50));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Simple quadratic curve
    const curve = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * 0 + t * t * 1;
    const x = source.x + dx * t + curve * 20;
    const y = source.y + dy * t;

    waypoints.push({ x, y });
  }

  waypoints.push(target);

  const calculatedDistance = calculateDistance(waypoints);

  logger.debug('autoRoutingAlgorithm', 'Curved routing calculated', {
    waypoints: waypoints.length,
    distance: Math.round(calculatedDistance),
  });

  return {
    waypoints,
    isOptimal: false,
    distance: calculatedDistance,
    complexity: waypoints.length - 2,
    routingType: 'curved',
    obstaclesAvoided: 0,
  };
};

/**
 * Calculate direct routing (straight line)
 */
export const calculateDirectRouting = (
  source: Point,
  target: Point
): RoutingResult => {
  const waypoints = [source, target];
  const distance = Math.sqrt(
    Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2)
  );

  logger.debug('autoRoutingAlgorithm', 'Direct routing calculated', {
    distance: Math.round(distance),
  });

  return {
    waypoints,
    isOptimal: true,
    distance,
    complexity: 0,
    routingType: 'direct',
    obstaclesAvoided: 0,
  };
};

/**
 * Main routing function - chooses best algorithm
 */
export const calculateRoute = (
  source: Point,
  target: Point,
  obstacles: DrawElement[] = [],
  config: Partial<RoutingConfig> = {}
): RoutingResult => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  switch (finalConfig.routingType) {
    case 'orthogonal':
      return calculateOrthogonalRouting(source, target, obstacles, finalConfig);

    case 'curved':
      return calculateCurvedRouting(source, target, obstacles, finalConfig);

    case 'direct':
      return calculateDirectRouting(source, target);

    default:
      return calculateOrthogonalRouting(source, target, obstacles, finalConfig);
  }
};

/**
 * Calculate cost of a path (distance + obstacles)
 */
const calculatePathCost = (
  path: Point[],
  obstacles: DrawElement[],
  config: RoutingConfig
): number => {
  let cost = 0;

  // Add distance cost
  cost += calculateDistance(path);

  // Add obstacle cost if avoidance is enabled
  if (config.avoidObstacles) {
    for (let i = 0; i < path.length - 1; i++) {
      const segment = [path[i], path[i + 1]];
      const collisions = countCollisions(segment, obstacles, config.minDistance || 10);
      cost += collisions * 100; // High penalty for collisions
    }
  }

  return cost;
};

/**
 * Count collisions between a path segment and obstacles
 */
const countCollisions = (
  segment: Point[],
  obstacles: DrawElement[],
  minDistance: number
): number => {
  let collisions = 0;

  for (const obstacle of obstacles) {
    const obstaclePoints = [obstacle.start, obstacle.end];

    for (const obstPoint of obstaclePoints) {
      if (isPointNearSegment(obstPoint, segment[0], segment[1], minDistance)) {
        collisions++;
      }
    }
  }

  return collisions;
};

/**
 * Check if point is near a line segment
 */
const isPointNearSegment = (
  point: Point,
  start: Point,
  end: Point,
  distance: number
): boolean => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return getDistance(point, start) <= distance;
  }

  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;

  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2) <= distance;
};

/**
 * Calculate total distance of a path
 */
const calculateDistance = (waypoints: Point[]): number => {
  let distance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    distance += getDistance(waypoints[i], waypoints[i + 1]);
  }

  return distance;
};

/**
 * Calculate distance between two points
 */
const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Snap point to grid
 */
const snapToGrid = (point: Point, gridSize: number): Point => {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
};

/**
 * Remove redundant waypoints (collinear points)
 */
const removeRedundantWaypoints = (waypoints: Point[]): Point[] => {
  if (waypoints.length <= 2) return waypoints;

  const result = [waypoints[0]];

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    // Check if current point is collinear with prev and next
    const crossProduct =
      (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);

    // Small threshold for floating-point errors
    if (Math.abs(crossProduct) > 0.01) {
      result.push(curr);
    }
  }

  result.push(waypoints[waypoints.length - 1]);
  return result;
};

/**
 * Optimize routing result by reducing waypoints
 */
export const optimizeRoute = (result: RoutingResult): RoutingResult => {
  return {
    ...result,
    waypoints: removeRedundantWaypoints(result.waypoints),
  };
};
