/**
 * @file ConnectorRenderer.tsx
 * @brief Component for rendering connectors between elements
 */

import React from 'react';
import { Connector, getDashArray, getArrowMarkerPath } from '../utils/connectorStyles';

interface ConnectorRendererProps {
  connectors: Connector[];
  selectedConnectorId?: string;
  onConnectorClick?: (connectorId: string) => void;
  zoom?: number;
}

export const ConnectorRenderer: React.FC<ConnectorRendererProps> = ({
  connectors,
  selectedConnectorId,
  onConnectorClick,
  zoom = 1,
}) => {
  const createPath = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Create a smooth curve
    const controlDistance = Math.max(distance * 0.25, 50);
    const angle = Math.atan2(dy, dx) + Math.PI / 2;

    const cx = midX + controlDistance * Math.cos(angle);
    const cy = midY + controlDistance * Math.sin(angle);

    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  };

  return (
    <g className="connectors">
      <defs>
        {connectors.map((connector) => {
          const arrowId = `arrow-${connector.id}`;
          const endArrowPath = getArrowMarkerPath(connector.style.endArrow, connector.style.lineWidth);
          const startArrowPath = getArrowMarkerPath(connector.style.startArrow, connector.style.lineWidth);

          return (
            <g key={`defs-${connector.id}`}>
              {connector.style.endArrow !== 'none' && endArrowPath && (
                <marker
                  id={arrowId}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path
                    d={endArrowPath}
                    fill={connector.style.color}
                    opacity={connector.style.opacity}
                  />
                </marker>
              )}
              {connector.style.startArrow !== 'none' && startArrowPath && (
                <marker
                  id={`${arrowId}-start`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="1"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path
                    d={startArrowPath}
                    fill={connector.style.color}
                    opacity={connector.style.opacity}
                  />
                </marker>
              )}
            </g>
          );
        })}
      </defs>

      {connectors.map((connector) => {
        const isSelected = selectedConnectorId === connector.id;
        const dashArray = getDashArray(connector.style.lineStyle, connector.style.lineWidth);

        return (
          <g key={connector.id} className={`connector ${isSelected ? 'selected' : ''}`}>
            {/* Invisible wider line for easier selection */}
            <path
              d={createPath(connector.fromPoint, connector.toPoint)}
              stroke="transparent"
              strokeWidth={Math.max(connector.style.lineWidth + 4, 8)}
              fill="none"
              style={{ cursor: 'pointer' }}
              onClick={() => onConnectorClick?.(connector.id)}
            />

            {/* Visible connector line */}
            <path
              d={createPath(connector.fromPoint, connector.toPoint)}
              stroke={connector.style.color}
              strokeWidth={connector.style.lineWidth}
              strokeDasharray={dashArray}
              fill="none"
              opacity={connector.style.opacity}
              markerEnd={
                connector.style.endArrow !== 'none'
                  ? `url(#arrow-${connector.id})`
                  : undefined
              }
              markerStart={
                connector.style.startArrow !== 'none'
                  ? `url(#arrow-${connector.id}-start)`
                  : undefined
              }
              style={{ pointerEvents: 'none' }}
            />

            {/* Selection highlight */}
            {isSelected && (
              <path
                d={createPath(connector.fromPoint, connector.toPoint)}
                stroke="#0066ff"
                strokeWidth={connector.style.lineWidth + 2}
                fill="none"
                opacity="0.3"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Label if present */}
            {connector.label && (
              <text
                x={(connector.fromPoint.x + connector.toPoint.x) / 2}
                y={(connector.fromPoint.y + connector.toPoint.y) / 2 - 8}
                textAnchor="middle"
                fontSize="12"
                fill="#333"
                style={{
                  backgroundColor: 'white',
                  padding: '2px 4px',
                  pointerEvents: 'none',
                }}
              >
                {connector.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};
