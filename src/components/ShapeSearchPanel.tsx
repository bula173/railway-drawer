/**
 * @file ShapeSearchPanel.tsx
 * @brief UI component for shape search and filtering
 *
 * Features:
 * - Search bar with autocomplete
 * - Category filter
 * - Tag-based filtering
 * - Recent shapes display
 * - Quick shape preview
 * - Keyboard shortcuts (Ctrl+K to open)
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useShapeSearch } from '../hooks/useShapeSearch';
import { logger } from '../utils/logger';
import type { DrawElement } from './Elements';

/**
 * @interface ShapeSearchPanelProps
 * @brief Props for ShapeSearchPanel
 */
export interface ShapeSearchPanelProps {
  onShapeSelect?: (shape: DrawElement, libraryId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  position?: 'left' | 'right' | 'modal';
}

/**
 * @component ShapeSearchPanel
 * @brief Search panel for finding and selecting shapes
 *
 * Features draw.io-inspired search with:
 * - Full-text search
 * - Category filtering
 * - Tag filtering
 * - Recent shapes
 * - Keyboard shortcuts
 */
export const ShapeSearchPanel: React.FC<ShapeSearchPanelProps> = ({
  onShapeSelect,
  isOpen = true,
  onClose,
  position = 'left',
}) => {
  const search = useShapeSearch();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle keyboard shortcut (Ctrl+K)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsKeyboardOpen(!isKeyboardOpen);
        if (!isKeyboardOpen && inputRef.current) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }

      // Close on Escape
      if (e.key === 'Escape' && isKeyboardOpen) {
        setIsKeyboardOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardOpen]);

  /**
   * Handle shape selection
   */
  const handleShapeSelect = useCallback(
    (shape: DrawElement, libraryId: string) => {
      logger.info('ShapeSearchPanel', 'Shape selected', { shapeId: shape.id });
      search.recordShapeUsage({ shape, libraryId, libraryName: '', matchScore: 0, matchedFields: [] });
      onShapeSelect?.(shape, libraryId);
    },
    [search, onShapeSelect]
  );

  /**
   * Render search input
   */
  const renderSearchInput = () => (
    <div style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search shapes... (Ctrl+K)"
        value={search.query}
        onChange={e => search.setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px',
        }}
      />
    </div>
  );

  /**
   * Render category tabs (professional draw.io style)
   */
  const renderCategoryTabs = () => {
    const categories = search.getCategories();
    const allCategories = [null, ...categories];

    return (
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#f8f8f8',
        overflowX: 'auto',
      }}>
        {allCategories.map((cat) => {
          const isActive = search.category === cat;
          const label = cat === null ? '📦 All' : `${getCategoryIcon(cat as string)} ${cat}`;

          return (
            <button
              key={cat || 'all'}
              onClick={() => search.setCategory(cat)}
              style={{
                flex: 'none',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: isActive ? '600' : '500',
                backgroundColor: isActive ? 'white' : 'transparent',
                color: isActive ? '#0066cc' : '#666',
                border: 'none',
                borderBottom: isActive ? '2px solid #0066cc' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
              }}
              title={cat ? `Show ${cat} shapes` : 'Show all shapes'}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * Get category icon for display
   */
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'railway': '🚂',
      'signaling': '🚦',
      'junction': '🔀',
      'track': '🛤️',
      'station': '🏢',
      'general': '📦',
      'arrows': '➡️',
      'uml': '📊',
      'sequence': '📋',
      'ertms': '⚡',
      'structures': '🏗️',
      'switches': '🔘',
    };
    return icons[category.toLowerCase()] || '▪️';
  };

  /**
   * Render tag filter
   */
  const renderTagFilter = () => {
    const tags = search.getTags();
    if (tags.length === 0) return null;

    return (
      <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
          Tags:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {tags.slice(0, 15).map(tag => (
            <button
              key={tag}
              onClick={() => search.toggleTag(tag)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: search.selectedTags.includes(tag) ? '#28a745' : '#f0f0f0',
                color: search.selectedTags.includes(tag) ? 'white' : 'black',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Render search results organized by library with drag support
   */
  const renderResults = () => {
    if (search.isSearching) {
      return (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
          Searching...
        </div>
      );
    }

    if (search.results.length === 0) {
      return (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
          <div>No shapes found</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Try: "track", "signal", "platform"
          </div>
        </div>
      );
    }

    // Group results by library
    const groupedByLibrary = search.results.reduce((acc, result) => {
      if (!acc[result.libraryId]) {
        acc[result.libraryId] = [];
      }
      acc[result.libraryId].push(result);
      return acc;
    }, {} as Record<string, typeof search.results>);

    return (
      <div
        style={{
          maxHeight: '600px',
          overflowY: 'auto',
          padding: '8px',
        }}
      >
        {Object.entries(groupedByLibrary).map(([libraryId, results]) => (
          <div key={libraryId} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', padding: '4px 8px', backgroundColor: '#f0f0f0' }}>
              {results[0]?.libraryName}
            </div>
            <div>
              {results.map(result => (
                <div
                  key={`${result.libraryId}-${result.shape.id}`}
                  draggable
                  onDragStart={(e) => {
                    logger.info('ShapeSearchPanel', 'Drag started', { shapeId: result.shape.id });
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/railway-item', JSON.stringify(result.shape));
                    handleShapeSelect(result.shape, result.libraryId);
                  }}
                  onClick={() => handleShapeSelect(result.shape, result.libraryId)}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: '#f9f9f9',
                    border: '1px solid #e0e0e0',
                    cursor: 'grab',
                    transition: 'all 0.2s',
                    borderLeft: '3px solid #007bff',
                    userSelect: 'none',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#e3f2fd';
                    (e.currentTarget as HTMLElement).style.borderLeftColor = '#0056b3';
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#f9f9f9';
                    (e.currentTarget as HTMLElement).style.borderLeftColor = '#007bff';
                  }}
                >
                  {/* SVG Miniature Preview */}
                  <div
                    style={{
                      minWidth: '48px',
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {result.shape.shapeElements && result.shape.shapeElements.length > 0 ? (
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        {result.shape.shapeElements.map((elem: any) => (
                          <g key={elem.id} dangerouslySetInnerHTML={{ __html: elem.svg }} />
                        ))}
                      </svg>
                    ) : (
                      <div style={{ fontSize: '10px', color: '#999' }}>No preview</div>
                    )}
                  </div>

                  {/* Shape Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#333' }}>
                      {result.shape.name || result.shape.id}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                      {result.shape.type}
                    </div>
                    <div style={{ fontSize: '9px', color: '#999', marginTop: '2px' }}>
                      📌 Drag to canvas
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ fontSize: '11px', color: '#999', padding: '8px', textAlign: 'center' }}>
          {search.results.length} shapes
        </div>
      </div>
    );
  };

  /**
   * Render recent shapes
   */
  const renderRecentShapes = () => {
    const recent = search.getRecentShapes();
    if (recent.length === 0) {
      return (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
          <div>Start searching to add recent shapes</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Try: "signal", "track", "platform"
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
          Recent Shapes:
        </div>
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {recent.map(result => (
            <div
              key={`recent-${result.shape.id}`}
              onClick={() => handleShapeSelect(result.shape, result.libraryId)}
              style={{
                padding: '6px',
                marginBottom: '4px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f9f9f9';
              }}
            >
              {result.shape.id}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen && position === 'modal') {
    return null;
  }

  const panelContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      }}
    >
      {renderSearchInput()}
      {renderCategoryTabs()}
      {renderTagFilter()}
      {renderResults()}
    </div>
  );

  if (position === 'modal') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}
        onClick={() => onClose?.()}
      >
        <div
          style={{
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
          }}
          onClick={e => e.stopPropagation()}
        >
          {panelContent}
        </div>
      </div>
    );
  }

  return panelContent;
};
