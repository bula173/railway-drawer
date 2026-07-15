/**
 * @file PrimitiveToolbox.tsx
 * @brief Toolbox for adding primitive shapes to composer
 *
 * Provides buttons for each primitive type that can be added to the shape
 */

import React, { useCallback } from 'react';
import { Circle, Line, Square, Hexagon, Pen, Type, Arc } from 'lucide-react';
import { ShapePrimitive, PrimitiveElement } from '../../types/shapeComposer';
import './styles/primitiveToolbox.css';

export interface PrimitiveToolboxProps {
  onAddPrimitive?: (element: PrimitiveElement) => void;
}

const PRIMITIVES: Array<{
  type: ShapePrimitive;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    type: 'circle',
    label: 'Circle',
    icon: <Circle size={20} />,
    description: 'Add a circle',
  },
  {
    type: 'rectangle',
    label: 'Rectangle',
    icon: <Square size={20} />,
    description: 'Add a rectangle',
  },
  {
    type: 'line',
    label: 'Line',
    icon: <Line size={20} />,
    description: 'Add a line',
  },
  {
    type: 'polygon',
    label: 'Polygon',
    icon: <Hexagon size={20} />,
    description: 'Add a polygon',
  },
  {
    type: 'path',
    label: 'Path',
    icon: <Pen size={20} />,
    description: 'Add a custom path',
  },
  {
    type: 'text',
    label: 'Text',
    icon: <Type size={20} />,
    description: 'Add text label',
  },
  {
    type: 'arc',
    label: 'Arc',
    icon: <Arc size={20} />,
    description: 'Add an arc',
  },
];

/**
 * Toolbox for adding primitives to the shape
 */
export const PrimitiveToolbox: React.FC<PrimitiveToolboxProps> = ({ onAddPrimitive }) => {
  // Create default primitive
  const createDefaultPrimitive = useCallback(
    (type: ShapePrimitive): PrimitiveElement => {
      const id = `${type}_${Date.now()}`;
      const baseElement: PrimitiveElement = {
        id,
        type,
        x: 50,
        y: 50,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1,
      };

      switch (type) {
        case 'circle':
          return {
            ...baseElement,
            circle: { radius: 30 },
          };
        case 'rectangle':
          return {
            ...baseElement,
            rectangle: { width: 100, height: 60, rx: 0 },
          };
        case 'line':
          return {
            ...baseElement,
            line: { x2: 100, y2: 50 },
            fill: 'none',
          };
        case 'polygon':
          return {
            ...baseElement,
            polygon: {
              points: [
                { x: 50, y: 0 },
                { x: 100, y: 25 },
                { x: 75, y: 75 },
                { x: 25, y: 75 },
                { x: 0, y: 25 },
              ],
            },
          };
        case 'path':
          return {
            ...baseElement,
            path: { d: 'M 0 0 L 100 50 L 50 100' },
            fill: 'none',
          };
        case 'text':
          return {
            ...baseElement,
            text: {
              content: 'Text',
              fontSize: 14,
              fontFamily: 'Arial',
              textAnchor: 'middle',
            },
            fill: '#000000',
          };
        case 'arc':
          return {
            ...baseElement,
            arc: { radius: 40, startAngle: 0, endAngle: 90 },
            fill: 'none',
          };
        default:
          return baseElement;
      }
    },
    []
  );

  const handleAddPrimitive = (type: ShapePrimitive) => {
    const primitive = createDefaultPrimitive(type);
    onAddPrimitive?.(primitive);
  };

  return (
    <div className="primitive-toolbox">
      <div className="toolbox-header">
        <h3>Add Primitive</h3>
      </div>
      <div className="toolbox-buttons">
        {PRIMITIVES.map(primitive => (
          <button
            key={primitive.type}
            className="primitive-button"
            onClick={() => handleAddPrimitive(primitive.type)}
            title={primitive.description}
            aria-label={primitive.description}
          >
            <span className="button-icon">{primitive.icon}</span>
            <span className="button-label">{primitive.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
