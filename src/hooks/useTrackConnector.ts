/**
 * @file useTrackConnector.ts
 * @brief Hook for managing smart track connections
 *
 * Features:
 * - Auto-routing between tracks
 * - Connection validation
 * - Snap to endpoints
 * - Obstacle avoidance
 * - Connection type selection
 */

import { useCallback, useRef, useState } from 'react';
import type { DrawElement } from '../components/Elements';
import {
  validateTrackConnection,
  getConnectionPoint,
  findBestConnectionPoints,
} from '../utils/trackConnectionValidator';
import {
  calculateRoute,
  optimizeRoute,
  type RoutingConfig,
  type Point,
} from '../utils/autoRoutingAlgorithm';
import { logger } from '../utils/logger';

/**
 * @interface TrackConnection
 * @brief Represents a connection between two tracks
 */
export interface TrackConnection {
  id: string;
  sourceElementId: string;
  sourcePoint: 'start' | 'end';
  targetElementId: string;
  targetPoint: 'start' | 'end';
  connectionType: 'direct' | 'junction' | 'crossover';
  routingPath: Point[];
  isValid: boolean;
  createdAt: Date;
  waypoints: Point[];
}

/**
 * @interface UseTrackConnectorOptions
 * @brief Options for track connector hook
 */
export interface UseTrackConnectorOptions {
  gridSize?: number;
  snapToGrid?: boolean;
  snapDistance?: number;
  autoAvoidObstacles?: boolean;
  routingType?: 'orthogonal' | 'curved' | 'direct';
}

/**
 * @hook useTrackConnector
 * @brief Hook for smart track connections
 *
 * Manages:
 * - Connection state (pending, active, completed)
 * - Auto-routing calculation
 * - Endpoint snapping
 * - Validation and feedback
 */
export const useTrackConnector = (
  elements: DrawElement[],
  options: UseTrackConnectorOptions = {}
) => {
  const {
    gridSize = 20,
    snapToGrid = true,
    _snapDistance = 30,
    autoAvoidObstacles = true,
    routingType = 'orthogonal',
  } = options;

  const [connections, setConnections] = useState<Map<string, TrackConnection>>(new Map());
  const [activeConnection, setActiveConnection] = useState<TrackConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  const connectionIdRef = useRef(0);

  /**
   * Find element by ID
   */
  const findElement = useCallback(
    (id: string): DrawElement | undefined => {
      return elements.find(el => el.id === id);
    },
    [elements]
  );

  /**
   * Start connecting two elements
   */
  const startConnection = useCallback(
    (sourceId: string, targetId: string, connectionType: 'direct' | 'junction' | 'crossover' = 'direct') => {
      logger.info('useTrackConnector', 'Starting connection', {
        source: sourceId,
        target: targetId,
        type: connectionType,
      });

      setConnectionError(null);
      setIsConnecting(true);

      const sourceElement = findElement(sourceId);
      const targetElement = findElement(targetId);

      if (!sourceElement || !targetElement) {
        setConnectionError('Element not found');
        setIsConnecting(false);
        return null;
      }

      // Find best connection points
      const connectionPoints = findBestConnectionPoints(sourceElement, targetElement);
      if (!connectionPoints) {
        setConnectionError('No valid connection points found');
        setIsConnecting(false);
        return null;
      }

      const { sourcePoint, targetPoint } = connectionPoints;

      // Validate connection
      const validation = validateTrackConnection(
        sourceElement,
        targetElement,
        connectionType
      );

      if (!validation.canConnect) {
        setConnectionError(validation.errors.join('; '));
        setIsConnecting(false);
        return null;
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        logger.warn('useTrackConnector', 'Connection warnings', {
          warnings: validation.warnings,
        });
      }

      // Calculate routing
      const sourceCoords = getConnectionPoint(sourceElement, sourcePoint);
      const targetCoords = getConnectionPoint(targetElement, targetPoint);

      const routingConfig: RoutingConfig = {
        routingType,
        gridSize,
        avoidObstacles: autoAvoidObstacles,
        snapToGrid,
      };

      const routingResult = calculateRoute(
        sourceCoords,
        targetCoords,
        elements,
        routingConfig
      );

      const optimizedResult = optimizeRoute(routingResult);

      // Create connection
      const connection: TrackConnection = {
        id: `conn-${++connectionIdRef.current}`,
        sourceElementId: sourceId,
        sourcePoint,
        targetElementId: targetId,
        targetPoint,
        connectionType,
        routingPath: optimizedResult.waypoints,
        isValid: validation.isValid,
        createdAt: new Date(),
        waypoints: optimizedResult.waypoints,
      };

      setActiveConnection(connection);
      setIsConnecting(false);

      logger.info('useTrackConnector', 'Connection created', {
        id: connection.id,
        waypoints: connection.waypoints.length,
      });

      return connection;
    },
    [findElement, elements, gridSize, snapToGrid, autoAvoidObstacles, routingType]
  );

  /**
   * Confirm and save connection
   */
  const confirmConnection = useCallback(() => {
    if (!activeConnection) return false;

    logger.info('useTrackConnector', 'Confirming connection', {
      id: activeConnection.id,
    });

    const newConnections = new Map(connections);
    newConnections.set(activeConnection.id, activeConnection);
    setConnections(newConnections);
    setActiveConnection(null);

    return true;
  }, [activeConnection, connections]);

  /**
   * Cancel active connection
   */
  const cancelConnection = useCallback(() => {
    logger.debug('useTrackConnector', 'Canceling connection');
    setActiveConnection(null);
    setConnectionError(null);
  }, []);

  /**
   * Delete a connection
   */
  const deleteConnection = useCallback((connectionId: string) => {
    logger.info('useTrackConnector', 'Deleting connection', { id: connectionId });

    const newConnections = new Map(connections);
    newConnections.delete(connectionId);
    setConnections(newConnections);
  }, [connections]);

  /**
   * Get all connections for an element
   */
  const getElementConnections = useCallback(
    (elementId: string): TrackConnection[] => {
      return Array.from(connections.values()).filter(
        conn =>
          conn.sourceElementId === elementId || conn.targetElementId === elementId
      );
    },
    [connections]
  );

  /**
   * Get connection by ID
   */
  const getConnection = useCallback(
    (id: string): TrackConnection | undefined => {
      return connections.get(id);
    },
    [connections]
  );

  /**
   * Recalculate routing for all connections
   */
  const recalculateRouting = useCallback(() => {
    logger.info('useTrackConnector', 'Recalculating routing for all connections');

    const updatedConnections = new Map(connections);

    updatedConnections.forEach((connection, id) => {
      const sourceElement = findElement(connection.sourceElementId);
      const targetElement = findElement(connection.targetElementId);

      if (!sourceElement || !targetElement) return;

      const sourceCoords = getConnectionPoint(sourceElement, connection.sourcePoint);
      const targetCoords = getConnectionPoint(targetElement, connection.targetPoint);

      const routingConfig: RoutingConfig = {
        routingType,
        gridSize,
        avoidObstacles: autoAvoidObstacles,
        snapToGrid,
      };

      const routingResult = calculateRoute(
        sourceCoords,
        targetCoords,
        elements,
        routingConfig
      );

      const optimizedResult = optimizeRoute(routingResult);

      updatedConnections.set(id, {
        ...connection,
        routingPath: optimizedResult.waypoints,
        waypoints: optimizedResult.waypoints,
      });
    });

    setConnections(updatedConnections);
  }, [connections, findElement, elements, gridSize, snapToGrid, autoAvoidObstacles, routingType]);

  /**
   * Export connections as SVG paths
   */
  const exportAsPath = useCallback(
    (connectionId: string): string | null => {
      const connection = connections.get(connectionId);
      if (!connection) return null;

      const pathData = connection.waypoints
        .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

      return pathData;
    },
    [connections]
  );

  /**
   * Get connection statistics
   */
  const getStatistics = useCallback(() => {
    const allConnections = Array.from(connections.values());
    const totalDistance = allConnections.reduce((sum, conn) => {
      let distance = 0;
      for (let i = 0; i < conn.waypoints.length - 1; i++) {
        const dx = conn.waypoints[i + 1].x - conn.waypoints[i].x;
        const dy = conn.waypoints[i + 1].y - conn.waypoints[i].y;
        distance += Math.sqrt(dx * dx + dy * dy);
      }
      return sum + distance;
    }, 0);

    return {
      totalConnections: allConnections.length,
      totalDistance: Math.round(totalDistance),
      directConnections: allConnections.filter(c => c.connectionType === 'direct').length,
      junctions: allConnections.filter(c => c.connectionType === 'junction').length,
      crossovers: allConnections.filter(c => c.connectionType === 'crossover').length,
      averageWaypoints: allConnections.length > 0
        ? Math.round(
          allConnections.reduce((sum, c) => sum + c.waypoints.length, 0) /
            allConnections.length
        )
        : 0,
    };
  }, [connections]);

  return {
    // State
    connections: Array.from(connections.values()),
    activeConnection,
    isConnecting,
    connectionError,
    hoveredConnectionId,

    // Actions
    startConnection,
    confirmConnection,
    cancelConnection,
    deleteConnection,
    recalculateRouting,

    // Queries
    getElementConnections,
    getConnection,
    getStatistics,
    exportAsPath,

    // UI
    setHoveredConnectionId,
  };
};
