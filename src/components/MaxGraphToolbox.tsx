/**
 * @file MaxGraphToolbox.tsx
 * @brief Enhanced toolbox using all maxGraph built-in shapes
 *
 * Unified shape library with drag-drop support
 */

import React, { useState } from 'react';
import { MaxGraphShapePalette } from './MaxGraphShapePalette';
import { getAllMaxGraphShapes } from '../config/maxGraphShapes';
import type { ToolboxItem } from './Toolbox';
import './styles/maxGraphToolbox.css';

interface MaxGraphToolboxProps {
  onShapeDrag?: (shape: ToolboxItem, event: React.DragEvent) => void;
  onShapeSelect?: (shape: ToolboxItem) => void;
  width?: number | string;
  compact?: boolean;
}

export const MaxGraphToolbox: React.FC<MaxGraphToolboxProps> = ({
  onShapeDrag,
  onShapeSelect,
  width = '280px',
  compact = false,
}) => {
  const [selectedShape, setSelectedShape] = useState<ToolboxItem | null>(null);
  const [showPalette, setShowPalette] = useState(true);

  const shapes = getAllMaxGraphShapes();

  const handleShapeSelect = (shape: ToolboxItem) => {
    setSelectedShape(shape);
    onShapeSelect?.(shape);
  };

  const handleDragStart = (e: React.DragEvent, shape: ToolboxItem) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/railway-item', JSON.stringify(shape));
    onShapeDrag?.(shape, e);
  };

  return (
    <div className="maxgraph-toolbox" style={{ width }}>
      <div className="toolbox-header">
        <h3>Shapes Library</h3>
        <div className="header-stats">
          <span className="stat-badge">{shapes.length} shapes</span>
        </div>
      </div>

      <div className="toolbox-content">
        {showPalette ? (
          <MaxGraphShapePalette
            onShapeSelect={handleShapeSelect}
            searchable={true}
            compact={compact}
          />
        ) : (
          <div className="empty-state">
            <p>Shape palette hidden</p>
            <button onClick={() => setShowPalette(true)} className="show-btn">
              Show Palette
            </button>
          </div>
        )}
      </div>

      {selectedShape && (
        <div className="selected-shape-info">
          <div className="info-header">
            <h4>Selected Shape</h4>
            <button
              className="close-info"
              onClick={() => setSelectedShape(null)}
              title="Clear selection"
            >
              ✕
            </button>
          </div>
          <div className="shape-details">
            <div className="detail-row">
              <span className="label">Name:</span>
              <span className="value">{selectedShape.name}</span>
            </div>
            <div className="detail-row">
              <span className="label">ID:</span>
              <span className="value">{selectedShape.id}</span>
            </div>
            <div className="detail-row">
              <span className="label">Category:</span>
              <span className="value">{selectedShape.group}</span>
            </div>
            <div className="detail-row">
              <span className="label">Type:</span>
              <span className="value">{selectedShape.dimensionality}D</span>
            </div>
            {selectedShape.description && (
              <div className="detail-row">
                <span className="label">Description:</span>
                <span className="value">{selectedShape.description}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label">Size:</span>
              <span className="value">
                {selectedShape.width} × {selectedShape.height}
              </span>
            </div>
            <div className="shape-actions">
              <button
                className="btn btn-primary"
                draggable
                onDragStart={(e) => handleDragStart(e, selectedShape)}
              >
                Drag to Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toolbox-footer">
        <button
          className={`footer-btn ${showPalette ? 'active' : ''}`}
          onClick={() => setShowPalette(!showPalette)}
          title={showPalette ? 'Hide palette' : 'Show palette'}
        >
          {showPalette ? '🎨 Palette' : '📦 Library'}
        </button>
      </div>
    </div>
  );
};

MaxGraphToolbox.displayName = 'MaxGraphToolbox';
