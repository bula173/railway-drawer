/**
 * @file ConnectorRenderer.tsx
 * @brief Component for rendering connectors between elements
 */

import React from 'react';
import type { DrawElement } from './Elements';
import { getDashArray, getArrowMarkerPath } from '../utils/connectorStyles';
import { getConnectionPointsGrid } from '../utils/connectionManager';

interface ConnectorRendererProps {
  connectors: DrawElement[];
  selectedConnectorId?: string;
  onConnectorClick?: (connectorId: string, clickPos: { x: number; y: number }) => void;
  onEndpointDoubleClick?: (connectorId: string, endpoint: 'start' | 'end') => void;
  onEndpointHover?: (connectorId: string | null, endpoint: 'start' | 'end' | null) => void;
  onEndpointPointerDown?: (connectorId: string, endpoint: 'start' | 'end', pos: { x: number; y: number }) => void;
  hoveredConnectorEnd?: { connectorId: string; endpoint: 'start' | 'end' } | null;
  zoom?: number;
  allElements?: DrawElement[];
}

export const ConnectorRenderer: React.FC<ConnectorRendererProps> = ({
  connectors,
  selectedConnectorId,
  onConnectorClick,
  onEndpointDoubleClick,
  onEndpointHover,
  onEndpointPointerDown,
  hoveredConnectorEnd,
  zoom = 1,
  allElements = [],
}) => {
  console.log('📊 CONNECTOR RENDERER:', { count: connectors.length, ids: connectors.map(c => c.id) });

  const getClosestPointOnRectangle = (
    rect: { minX: number; maxX: number; minY: number; maxY: number },
    targetPoint: { x: number; y: number }
  ): { x: number; y: number } => {
    // Find the closest point on the rectangle edge to the target point
    const closestX = Math.max(rect.minX, Math.min(targetPoint.x, rect.maxX));
    const closestY = Math.max(rect.minY, Math.min(targetPoint.y, rect.maxY));
    return { x: closestX, y: closestY };
  };

  const getConnectorEndpoints = (connector: DrawElement): { from: { x: number; y: number }, to: { x: number; y: number } } => {
    // Determine if endpoints are attached or detached
    const fromIsAttached = connector.fromAttached !== false && !!connector.fromElementId;
    const toIsAttached = connector.toAttached !== false && !!connector.toElementId;

    // Look up connected elements
    const fromElement = fromIsAttached ? allElements.find(el => el.id === connector.fromElementId) : null;
    const toElement = toIsAttached ? allElements.find(el => el.id === connector.toElementId) : null;

    // Determine endpoints
    let fromPoint = connector.start;
    let toPoint = connector.end;

    // If attached with specific point index, use that point
    if (fromElement && fromIsAttached && connector.fromPointIndex !== undefined) {
      const points = getConnectionPointsGrid(fromElement);
      if (connector.fromPointIndex >= 0 && connector.fromPointIndex < points.length) {
        fromPoint = points[connector.fromPointIndex];
      }
    }

    if (toElement && toIsAttached && connector.toPointIndex !== undefined) {
      const points = getConnectionPointsGrid(toElement);
      if (connector.toPointIndex >= 0 && connector.toPointIndex < points.length) {
        toPoint = points[connector.toPointIndex];
      }
    }

    return { from: fromPoint, to: toPoint };
  };

  const createPath = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
    // Create a straight line
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  };

  const calculateLineAngle = (from: { x: number; y: number }, to: { x: number; y: number }): number => {
    // Calculate angle in degrees from start to end point
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  return (
    <g className="connectors">

      {connectors.map((connector) => {
        const isSelected = selectedConnectorId === connector.id;
        const style = connector.connectorStyle || { lineWidth: 2, endArrow: 'standard', startArrow: 'none', color: '#333333', opacity: 1, lineStyle: 'solid' };

        // Get dynamic endpoints based on connected elements' current positions
        const endpoints = getConnectorEndpoints(connector);

        // Calculate line angle for arrow orientation
        const lineAngle = calculateLineAngle(endpoints.from, endpoints.to);
        const reverseAngle = lineAngle + 180;

        // Use blue color for selected 1D objects, otherwise use connector's color
        const lineColor = isSelected ? '#0066ff' : style.color;

        return (
          <g key={connector.id} className={`connector ${isSelected ? 'selected' : ''}`}>
            {/* Invisible wider line for easier selection - always clickable */}
            <path
              d={createPath(endpoints.from, endpoints.to)}
              stroke="transparent"
              strokeWidth={Math.max(style.lineWidth + 4, 8)}
              fill="none"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                const svg = (e.target as SVGElement).ownerSVGElement;
                if (svg) {
                  const rect = svg.getBoundingClientRect();
                  const clickX = (e.clientX - rect.left);
                  const clickY = (e.clientY - rect.top);
                  onConnectorClick?.(connector.id, { x: clickX, y: clickY });
                }
              }}
            />

            {/* Visible connector line - changes to blue when selected (1D object selection) */}
            {/* Arrows at start point (if enabled) - oriented along line direction */}
            {style.startArrow !== 'none' && (
              <g transform={`translate(${endpoints.from.x}, ${endpoints.from.y}) rotate(${reverseAngle + 180})`}>
                <path
                  d={getArrowMarkerPath(style.startArrow, style.lineWidth)}
                  fill={lineColor}
                  opacity={style.opacity}
                  pointerEvents="none"
                />
              </g>
            )}

            {/* Main connector line - changes to blue when selected (1D object selection) */}
            <path
              d={createPath(endpoints.from, endpoints.to)}
              stroke={lineColor}
              strokeWidth={style.lineWidth}
              fill="none"
              opacity={style.opacity}
              style={{ pointerEvents: 'none' }}
            />

            {/* Arrow at end point (if enabled) - oriented along line direction */}
            {style.endArrow !== 'none' && (
              <g transform={`translate(${endpoints.to.x}, ${endpoints.to.y}) rotate(${lineAngle + 180})`}>
                <path
                  d={getArrowMarkerPath(style.endArrow, style.lineWidth)}
                  fill={lineColor}
                  opacity={style.opacity}
                  pointerEvents="none"
                />
              </g>
            )}

            {/* Label if present */}
            {connector.name && (
              <text
                x={(endpoints.from.x + endpoints.to.x) / 2}
                y={(endpoints.from.y + endpoints.to.y) / 2 - 8}
                textAnchor="middle"
                fontSize="12"
                fill="#333"
                style={{
                  backgroundColor: 'white',
                  padding: '2px 4px',
                  pointerEvents: 'none',
                }}
              >
                {connector.name}
              </text>
            )}

            {/* Endpoint circles - only show when selected */}
            {isSelected && (
              <>
                <circle
                  cx={endpoints.from.x}
                  cy={endpoints.from.y}
                  r={5}
                  fill={hoveredConnectorEnd?.connectorId === connector.id && hoveredConnectorEnd?.endpoint === 'start' ? '#0066ff' : 'none'}
                  stroke="#0066ff"
                  strokeWidth={2}
                  opacity={0.8}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onEndpointHover?.(connector.id, 'start')}
                  onMouseLeave={() => onEndpointHover?.(null, null)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEndpointPointerDown?.(connector.id, 'start', { x: e.clientX, y: e.clientY });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEndpointDoubleClick?.(connector.id, 'start');
                  }}
                />

                <circle
                  cx={endpoints.to.x}
                  cy={endpoints.to.y}
                  r={5}
                  fill={hoveredConnectorEnd?.connectorId === connector.id && hoveredConnectorEnd?.endpoint === 'end' ? '#0066ff' : 'none'}
                  stroke="#0066ff"
                  strokeWidth={2}
                  opacity={0.8}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onEndpointHover?.(connector.id, 'end')}
                  onMouseLeave={() => onEndpointHover?.(null, null)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEndpointPointerDown?.(connector.id, 'end', { x: e.clientX, y: e.clientY });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEndpointDoubleClick?.(connector.id, 'end');
                  }}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};
