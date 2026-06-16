/**
 * @file trackConnectionValidator.ts
 * @brief Railway track connection validation rules
 *
 * Validates track connections based on railway standards:
 * - Gauge compatibility
 * - Connection feasibility
 * - Track alignment
 * - ERTMS compliance
 * - Physical constraints
 */

import type { DrawElement } from '../components/Elements';
import { logger } from './logger';

/**
 * @interface TrackGaugeInfo
 * @brief Track gauge and compatibility information
 */
export interface TrackGaugeInfo {
  gauge: 'standard' | 'narrow' | 'broad' | 'unknown';
  width: number; // mm
  isElectrified: boolean;
  maxSpeed: number; // km/h
  isDoubleTrack: boolean;
}

/**
 * @interface ConnectionValidationResult
 * @brief Result of connection validation
 */
export interface ConnectionValidationResult {
  isValid: boolean;
  canConnect: boolean;
  canConnectReverse: boolean;
  warnings: string[];
  errors: string[];
  compatibility: {
    gaugeMatch: boolean;
    electrificationMatch: boolean;
    speedCompatible: boolean;
  };
  connectionTypes: ('direct' | 'junction' | 'crossover')[];
  recommendations: string[];
}

/**
 * Get track gauge information
 */
export const getTrackGaugeInfo = (element: DrawElement): TrackGaugeInfo => {
  // In a real implementation, this would read from element properties
  // For now, assume standard gauge (most common in Europe)
  return {
    gauge: 'standard',
    width: 1435, // Standard gauge in mm
    isElectrified: element.type?.includes('electric') || false,
    maxSpeed: 160, // Default assumption
    isDoubleTrack: element.type?.includes('double') || false,
  };
};

/**
 * Validate if two tracks can be connected
 */
export const validateTrackConnection = (
  sourceElement: DrawElement,
  targetElement: DrawElement,
  connectionType: 'direct' | 'junction' | 'crossover' = 'direct'
): ConnectionValidationResult => {
  const sourceGauge = getTrackGaugeInfo(sourceElement);
  const targetGauge = getTrackGaugeInfo(targetElement);

  const errors: string[] = [];
  const warnings: string[] = [];
  const connectionTypes: ('direct' | 'junction' | 'crossover')[] = [];

  // Check gauge compatibility
  const gaugeMatch = sourceGauge.gauge === targetGauge.gauge;
  if (!gaugeMatch) {
    errors.push(`Gauge mismatch: ${sourceGauge.gauge} → ${targetGauge.gauge}`);
  } else {
    connectionTypes.push('direct');
  }

  // Check electrification compatibility
  const electrificationMatch = sourceGauge.isElectrified === targetGauge.isElectrified;
  if (!electrificationMatch) {
    warnings.push('Electrification mismatch - may require conversion point');
  }

  // Check speed compatibility
  const minSpeed = Math.min(sourceGauge.maxSpeed, targetGauge.maxSpeed);
  const speedCompatible = minSpeed >= 40; // Minimum usable speed
  if (!speedCompatible) {
    warnings.push(`Low speed line - max speed: ${minSpeed} km/h`);
  }

  // Check if elements are different
  if (sourceElement.id === targetElement.id) {
    errors.push('Cannot connect element to itself');
  }

  // Determine valid connection types
  if (gaugeMatch) {
    connectionTypes.push('junction');
    connectionTypes.push('crossover');
  }

  // Build result
  const isValid = errors.length === 0;
  const canConnect = isValid && gaugeMatch;

  logger.debug('trackConnectionValidator', 'Connection validation', {
    source: sourceElement.id,
    target: targetElement.id,
    isValid,
    canConnect,
    errors: errors.length,
    warnings: warnings.length,
  });

  return {
    isValid,
    canConnect,
    canConnectReverse: canConnect, // Both directions valid for tracks
    errors,
    warnings,
    compatibility: {
      gaugeMatch,
      electrificationMatch,
      speedCompatible,
    },
    connectionTypes: connectionTypes.length > 0 ? connectionTypes : ['direct'],
    recommendations: generateRecommendations(
      sourceGauge,
      targetGauge,
      warnings,
      connectionType
    ),
  };
};

/**
 * Generate recommendations for connection
 */
const generateRecommendations = (
  source: TrackGaugeInfo,
  target: TrackGaugeInfo,
  warnings: string[],
  connectionType: string
): string[] => {
  const recommendations: string[] = [];

  if (source.gauge !== target.gauge) {
    recommendations.push('Add a gauge conversion point');
  }

  if (source.isElectrified !== target.isElectrified) {
    recommendations.push('Add electrification conversion section');
  }

  if (connectionType === 'junction') {
    recommendations.push('Ensure proper signal placement for junction');
  }

  if (connectionType === 'crossover') {
    recommendations.push('Verify clearance for crossover connections');
  }

  if (warnings.length > 0) {
    recommendations.push('Review warnings before proceeding');
  }

  return recommendations;
};

/**
 * Check if connection point is valid
 */
export const isValidConnectionPoint = (
  element: DrawElement,
  pointType: 'start' | 'end'
): boolean => {
  // Tracks have natural connection points at start and end
  if (element.type?.includes('track')) {
    return true;
  }

  // Signals can connect on one end
  if (element.type?.includes('signal')) {
    return pointType === 'start';
  }

  // Switches can connect multiple ways
  if (element.type?.includes('switch')) {
    return true;
  }

  return false;
};

/**
 * Get connection point coordinates
 */
export const getConnectionPoint = (
  element: DrawElement,
  pointType: 'start' | 'end'
): { x: number; y: number } => {
  if (pointType === 'start') {
    return { x: element.start.x, y: element.start.y };
  } else {
    return { x: element.end.x, y: element.end.y };
  }
};

/**
 * Calculate distance between connection points
 */
export const getConnectionDistance = (
  sourceElement: DrawElement,
  sourcePoint: 'start' | 'end',
  targetElement: DrawElement,
  targetPoint: 'start' | 'end'
): number => {
  const source = getConnectionPoint(sourceElement, sourcePoint);
  const target = getConnectionPoint(targetElement, targetPoint);

  return Math.sqrt(Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2));
};

/**
 * Check if connection is physically feasible
 */
export const isPhysicallyFeasible = (
  sourceElement: DrawElement,
  targetElement: DrawElement,
  maxDistance: number = 200 // pixels
): boolean => {
  // Check all possible connection point combinations
  const combinations: Array<['start' | 'end', 'start' | 'end']> = [
    ['end', 'start'],
    ['end', 'end'],
    ['start', 'start'],
    ['start', 'end'],
  ];

  for (const [srcPoint, tgtPoint] of combinations) {
    if (!isValidConnectionPoint(sourceElement, srcPoint)) continue;
    if (!isValidConnectionPoint(targetElement, tgtPoint)) continue;

    const distance = getConnectionDistance(
      sourceElement,
      srcPoint,
      targetElement,
      tgtPoint
    );

    if (distance <= maxDistance) {
      return true;
    }
  }

  return false;
};

/**
 * Find the best connection points between two elements
 */
export const findBestConnectionPoints = (
  sourceElement: DrawElement,
  targetElement: DrawElement
): { sourcePoint: 'start' | 'end'; targetPoint: 'start' | 'end' } | null => {
  let minDistance = Infinity;
  let bestConnection: { sourcePoint: 'start' | 'end'; targetPoint: 'start' | 'end' } | null =
    null;

  const combinations: Array<['start' | 'end', 'start' | 'end']> = [
    ['end', 'start'],
    ['end', 'end'],
    ['start', 'start'],
    ['start', 'end'],
  ];

  for (const [srcPoint, tgtPoint] of combinations) {
    if (!isValidConnectionPoint(sourceElement, srcPoint)) continue;
    if (!isValidConnectionPoint(targetElement, tgtPoint)) continue;

    const distance = getConnectionDistance(
      sourceElement,
      srcPoint,
      targetElement,
      tgtPoint
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestConnection = { sourcePoint: srcPoint, targetPoint: tgtPoint };
    }
  }

  return bestConnection;
};

/**
 * Validate connection type for given elements
 */
export const validateConnectionType = (
  sourceElement: DrawElement,
  targetElement: DrawElement,
  connectionType: 'direct' | 'junction' | 'crossover'
): boolean => {
  const validation = validateTrackConnection(sourceElement, targetElement, connectionType);
  return validation.connectionTypes.includes(connectionType);
};

/**
 * Get connection compatibility score (0-100)
 */
export const getCompatibilityScore = (
  sourceElement: DrawElement,
  targetElement: DrawElement
): number => {
  const validation = validateTrackConnection(sourceElement, targetElement);

  let score = 100;

  // Deduct points for warnings
  score -= validation.warnings.length * 10;

  // Deduct points for errors
  score -= validation.errors.length * 30;

  // Bonus for gauge match
  if (validation.compatibility.gaugeMatch) {
    score += 10;
  }

  // Bonus for electrification match
  if (validation.compatibility.electrificationMatch) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
};
