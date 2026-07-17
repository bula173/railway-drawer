/**
 * @file MaxGraphShapePalette.tsx
 * @brief Shape palette with all maxGraph built-in shapes
 *
 * Displays organized categories of shapes ready for drag-drop
 */

import React, { useState, useMemo } from 'react';
import {
  getAllMaxGraphShapes,
  getShapeCategories,
  getMaxGraphShapeStyle,
} from '../config/maxGraphShapes';
import type { ToolboxItem } from './Toolbox';
import './styles/maxGraphShapePalette.css';

interface MaxGraphShapePaletteProps {
  onShapeSelect?: (shape: ToolboxItem) => void;
  compact?: boolean;
  searchable?: boolean;
}

export const MaxGraphShapePalette: React.FC<MaxGraphShapePaletteProps> = ({
  onShapeSelect,
  compact = false,
  searchable = true,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(getShapeCategories())
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);

  const shapes = useMemo(() => {
    const allShapes = getAllMaxGraphShapes();
    if (!searchTerm) return allShapes;

    return allShapes.filter(
      shape =>
        shape.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shape.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, shape: ToolboxItem) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/railway-item', JSON.stringify(shape));
  };

  const handleShapeClick = (shape: ToolboxItem) => {
    onShapeSelect?.(shape);
  };

  const categories = getShapeCategories();
  const categoryGroups = useMemo(() => {
    const groups: Record<string, ToolboxItem[]> = {};
    categories.forEach(cat => {
      groups[cat] = shapes.filter(s => s.group === cat);
    });
    return groups;
  }, [shapes, categories]);

  return (
    <div className={`maxgraph-shape-palette ${compact ? 'compact' : ''}`}>
      {searchable && (
        <div className="palette-search">
          <input
            type="text"
            placeholder="Search shapes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="palette-content">
        {searchTerm ? (
          // Search results view
          <div className="search-results">
            {shapes.length === 0 ? (
              <div className="no-results">No shapes found</div>
            ) : (
              <div className="shape-grid">
                {shapes.map((shape) => (
                  <div
                    key={shape.id}
                    className={`shape-item ${hoveredShape === shape.id ? 'hovered' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, shape)}
                    onClick={() => handleShapeClick(shape)}
                    onMouseEnter={() => setHoveredShape(shape.id)}
                    onMouseLeave={() => setHoveredShape(null)}
                    title={shape.description || shape.name}
                  >
                    <div className="shape-preview">
                      <svg viewBox="0 0 80 80" className="shape-svg">
                        <rect
                          x="10"
                          y="10"
                          width="60"
                          height="60"
                          fill="#f0f0f0"
                          stroke="#999"
                          strokeWidth="1"
                          rx={shape.id.includes('rounded') ? '4' : '0'}
                        />
                      </svg>
                    </div>
                    <div className="shape-name">{shape.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Category view
          <div className="categories">
            {categories.map((category) => {
              const categoryShapes = categoryGroups[category] || [];
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="category">
                  <button
                    className={`category-header ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="category-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="category-name">{category}</span>
                    <span className="category-count">({categoryShapes.length})</span>
                  </button>

                  {isExpanded && (
                    <div className="shape-grid">
                      {categoryShapes.map((shape) => (
                        <div
                          key={shape.id}
                          className={`shape-item ${hoveredShape === shape.id ? 'hovered' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, shape)}
                          onClick={() => handleShapeClick(shape)}
                          onMouseEnter={() => setHoveredShape(shape.id)}
                          onMouseLeave={() => setHoveredShape(null)}
                          title={shape.description || shape.name}
                        >
                          <div className="shape-preview">
                            <svg
                              viewBox="0 0 80 80"
                              className="shape-svg"
                              style={{
                                filter: hoveredShape === shape.id ? 'drop-shadow(0 2px 4px rgba(25, 118, 210, 0.3))' : 'none',
                              }}
                            >
                              <rect
                                x="10"
                                y="10"
                                width="60"
                                height="60"
                                fill="#f0f0f0"
                                stroke="#999"
                                strokeWidth="1"
                                rx={shape.id.includes('rounded') ? '4' : '0'}
                              />
                            </svg>
                          </div>
                          <div className="shape-name">{shape.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="palette-stats">
        <small>
          {shapes.length} shape{shapes.length !== 1 ? 's' : ''} available
        </small>
      </div>
    </div>
  );
};

MaxGraphShapePalette.displayName = 'MaxGraphShapePalette';
