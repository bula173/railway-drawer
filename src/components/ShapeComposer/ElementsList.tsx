/**
 * @file ElementsList.tsx
 * @brief Hierarchical list of primitives in the composed shape
 *
 * Shows all primitives with visual previews, allows selection and reordering
 */

import React, { useCallback } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { PrimitiveElement, ComposedShape } from '../../types';
import './styles/elementsList.css';

export interface ElementsListProps {
  shape: ComposedShape;
  selectedElementId?: string;
  onSelectElement?: (id: string | undefined) => void;
  onDeleteElement?: (id: string) => void;
  onMoveElement?: (id: string, direction: 'up' | 'down') => void;
}

/**
 * List view of shape primitives
 */
export const ElementsList: React.FC<ElementsListProps> = ({
  shape,
  selectedElementId,
  onSelectElement,
  onDeleteElement,
  onMoveElement,
}) => {
  const sortedElements = [...shape.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const handleMoveUp = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMoveElement?.(id, 'up');
  };

  const handleMoveDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMoveElement?.(id, 'down');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteElement?.(id);
  };

  const getElementLabel = (element: PrimitiveElement): string => {
    switch (element.type) {
      case 'circle':
        return `Circle (r: ${element.circle?.radius || 0})`;
      case 'rectangle':
        return `Rectangle (${element.rectangle?.width || 0} × ${element.rectangle?.height || 0})`;
      case 'line':
        return 'Line';
      case 'polygon':
        return `Polygon (${element.polygon?.points.length || 0} points)`;
      case 'path':
        return 'Path';
      case 'text':
        return `Text: "${element.text?.content || ''}"`;
      case 'arc':
        return `Arc (${element.arc?.startAngle || 0}° → ${element.arc?.endAngle || 0}°)`;
      default:
        return element.type;
    }
  };

  return (
    <div className="elements-list">
      <div className="list-header">
        <h3>Elements ({shape.elements.length})</h3>
      </div>

      {shape.elements.length === 0 ? (
        <div className="empty-state">
          <p>No elements yet. Add a primitive from the toolbox.</p>
        </div>
      ) : (
        <div className="list-items">
          {sortedElements.map((element, index) => (
            <div
              key={element.id}
              className={`list-item ${selectedElementId === element.id ? 'selected' : ''}`}
              onClick={() => onSelectElement?.(element.id)}
            >
              <div className="item-content">
                <div className="item-icon">
                  {getElementIcon(element.type)}
                </div>
                <div className="item-info">
                  <div className="item-label">{getElementLabel(element)}</div>
                  <div className="item-meta">
                    ID: {element.id.substring(0, 8)}... | Z: {element.zIndex || 0}
                  </div>
                </div>
              </div>

              <div className="item-actions">
                <button
                  className="action-button"
                  onClick={e => handleMoveUp(e, element.id)}
                  disabled={index === 0}
                  title="Move up (increase z-index)"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  className="action-button"
                  onClick={e => handleMoveDown(e, element.id)}
                  disabled={index === sortedElements.length - 1}
                  title="Move down (decrease z-index)"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  className="action-button delete"
                  onClick={e => handleDelete(e, element.id)}
                  title="Delete element"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to get icon for element type
function getElementIcon(type: string): React.ReactNode {
  const iconProps = { size: 16, className: 'element-type-icon' };

  switch (type) {
    case 'circle':
      return <svg {...iconProps} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>;
    case 'rectangle':
      return <svg {...iconProps} viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" /></svg>;
    case 'line':
      return <svg {...iconProps} viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" /></svg>;
    case 'polygon':
      return <svg {...iconProps} viewBox="0 0 16 16"><polygon points="8,2 14,6 12,14 4,14 2,6" /></svg>;
    case 'path':
      return <svg {...iconProps} viewBox="0 0 16 16"><path d="M 2 8 Q 8 2 14 8" /></svg>;
    case 'text':
      return <svg {...iconProps} viewBox="0 0 16 16"><text x="2" y="12" fontSize="10">A</text></svg>;
    case 'arc':
      return <svg {...iconProps} viewBox="0 0 16 16"><path d="M 8 2 A 6 6 0 0 1 14 8" /></svg>;
    default:
      return null;
  }
}
