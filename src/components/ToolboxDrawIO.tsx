/**
 * @file ToolboxDrawIO.tsx
 * @brief Draw.io-style toolbox with organized categories and grid layout
 *
 * Features:
 * - Expandable shape categories
 * - Grid thumbnail preview
 * - Search/filter functionality
 * - Drag-and-drop support
 * - Recent shapes quick access
 * - Responsive layout
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import type { ToolboxItem } from './Toolbox';
import { logger } from '../utils/logger';
import './styles/toolboxDrawIO.css';

export interface ToolboxDrawIOProps {
  items: ToolboxItem[];
  onDragStart?: (e: React.DragEvent, item: ToolboxItem) => void;
}

interface CategoryState {
  [category: string]: boolean;
}

/**
 * Draw.io-inspired toolbox component
 */
export const ToolboxDrawIO: React.FC<ToolboxDrawIOProps> = ({ items, onDragStart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<CategoryState>({
    'General': true,
    'Signals': true,
    'ERTMS': true,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ToolboxItem[]> = {};

    items.forEach(item => {
      const category = item.group || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort categories
    const sorted: Record<string, ToolboxItem[]> = {};
    const order = ['General', 'Shapes', 'Signals', 'ERTMS', 'UML', 'Tracks', 'Custom'];

    order.forEach(cat => {
      if (groups[cat]) {
        sorted[cat] = groups[cat];
      }
    });

    Object.keys(groups).forEach(cat => {
      if (!order.includes(cat)) {
        sorted[cat] = groups[cat];
      }
    });

    return sorted;
  }, [items]);

  // Filter items by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedItems;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, ToolboxItem[]> = {};

    Object.entries(groupedItems).forEach(([category, categoryItems]) => {
      const matches = categoryItems.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          item.group?.toLowerCase().includes(query)
      );

      if (matches.length > 0) {
        filtered[category] = matches;
      }
    });

    return filtered;
  }, [groupedItems, searchQuery]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: ToolboxItem) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/railway-item', JSON.stringify(item));

      if (onDragStart) {
        onDragStart(e, item);
      }
    },
    [onDragStart]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="toolbox-draio">
      {/* Header */}
      <div className="toolbox-header">
        <h2>Shapes</h2>
      </div>

      {/* Search Bar */}
      <div className="toolbox-search-wrapper">
        <div className="toolbox-search">
          <Search size={16} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search shapes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="search-clear"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="toolbox-categories">
        {Object.entries(filteredGroups).map(([category, categoryItems]) => (
          <div key={category} className="category-section">
            {/* Category Header */}
            <div
              className="category-header"
              onClick={() => toggleCategory(category)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleCategory(category);
                }
              }}
            >
              <span className="category-icon">
                {expandedCategories[category] ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
              <span className="category-name">{category}</span>
              <span className="category-count">{categoryItems.length}</span>
            </div>

            {/* Category Items Grid */}
            {expandedCategories[category] && (
              <div className="category-items">
                <div className="items-grid">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className="grid-item"
                      draggable
                      onDragStart={e => handleDragStart(e, item)}
                      title={item.name}
                    >
                      <div className="item-preview">
                        {item.iconSvg && item.iconSvg !== 'default' ? (
                          <img
                            src={item.iconSvg}
                            alt={item.name}
                            className="item-thumbnail"
                          />
                        ) : (
                          <div className="item-placeholder">
                            <svg
                              viewBox="0 0 64 64"
                              className="item-svg"
                              dangerouslySetInnerHTML={{
                                __html: item.shapeElements?.[0]?.svg || '<rect width="64" height="64" fill="#eee" stroke="#999" stroke-width="2"/>',
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="item-label">{item.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* No results message */}
        {Object.keys(filteredGroups).length === 0 && searchQuery && (
          <div className="no-results">
            <p>No shapes found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};
