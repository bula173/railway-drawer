/**
 * @file TemplateGallery.tsx
 * @brief UI component for browsing and selecting railway templates
 *
 * Features:
 * - Browse templates by category
 * - Filter by difficulty
 * - Search templates
 * - Template preview
 * - Quick-start functionality
 */

import React, { useCallback, useState } from 'react';
import { useTemplate } from '../contexts/TemplateContext';
import type { RailwayTemplate } from '../contexts/TemplateContext';
import { logger } from '../utils/logger';

/**
 * @interface TemplateGalleryProps
 * @brief Props for TemplateGallery
 */
export interface TemplateGalleryProps {
  onTemplateSelect?: (template: RailwayTemplate) => void;
  isOpen?: boolean;
  onClose?: () => void;
  viewMode?: 'grid' | 'list';
}

/**
 * @component TemplateGallery
 * @brief Browse and select railway diagram templates
 *
 * Shows:
 * - Pre-built templates organized by category
 * - Difficulty-based filtering
 * - Search functionality
 * - Template preview
 * - Quick-start buttons
 */
export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  onTemplateSelect,
  isOpen = true,
  onClose,
  viewMode = 'grid',
}) => {
  const template = useTemplate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<RailwayTemplate | null>(null);

  /**
   * Get filtered templates
   */
  const filteredTemplates = template.searchTemplates(
    searchQuery,
    selectedCategory || undefined,
    selectedDifficulty || undefined
  );

  /**
   * Handle template selection
   */
  const handleSelectTemplate = useCallback(
    (selectedTemplate: RailwayTemplate) => {
      logger.info('TemplateGallery', 'Template selected', {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
      });

      // Record usage
      template.recordTemplateUsage(selectedTemplate.id);

      // Callback
      onTemplateSelect?.(selectedTemplate);
    },
    [template, onTemplateSelect]
  );

  /**
   * Get categories
   */
  const categories = Array.from(
    new Set(template.templates.map(t => t.category))
  ).sort();

  /**
   * Render template card
   */
  const renderTemplateCard = (tmpl: RailwayTemplate) => (
    <div
      key={tmpl.id}
      onClick={() => setPreviewTemplate(tmpl)}
      style={{
        padding: '12px',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        (e.currentTarget as HTMLElement).style.borderColor = '#007bff';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = '#ddd';
      }}
    >
      {/* Thumbnail */}
      {tmpl.thumbnail && (
        <img
          src={tmpl.thumbnail}
          alt={tmpl.name}
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '3px',
            marginBottom: '8px',
          }}
        />
      )}

      {/* Title */}
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
        {tmpl.name}
      </div>

      {/* Metadata */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        <div>
          Difficulty:{' '}
          <span
            style={{
              backgroundColor:
                tmpl.difficulty === 'beginner'
                  ? '#28a745'
                  : tmpl.difficulty === 'intermediate'
                    ? '#ffc107'
                    : '#dc3545',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              textTransform: 'capitalize',
            }}
          >
            {tmpl.difficulty}
          </span>
        </div>
        <div style={{ marginTop: '4px' }}>Elements: {tmpl.elements.length}</div>
        <div style={{ marginTop: '4px' }}>Used: {tmpl.usageCount}x</div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
        {tmpl.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            style={{
              backgroundColor: '#e7f3ff',
              color: '#004085',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Button */}
      <button
        onClick={e => {
          e.stopPropagation();
          handleSelectTemplate(tmpl);
        }}
        style={{
          width: '100%',
          padding: '6px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        Use Template
      </button>
    </div>
  );

  /**
   * Render category filter
   */
  const renderCategoryFilter = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
      <button
        onClick={() => setSelectedCategory(null)}
        style={{
          padding: '6px 12px',
          backgroundColor: selectedCategory === null ? '#007bff' : '#f0f0f0',
          color: selectedCategory === null ? 'white' : 'black',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => setSelectedCategory(cat)}
          style={{
            padding: '6px 12px',
            backgroundColor: selectedCategory === cat ? '#007bff' : '#f0f0f0',
            color: selectedCategory === cat ? 'white' : 'black',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'capitalize',
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );

  /**
   * Render difficulty filter
   */
  const renderDifficultyFilter = () => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      {['beginner', 'intermediate', 'advanced'].map(difficulty => (
        <button
          key={difficulty}
          onClick={() => setSelectedDifficulty(selectedDifficulty === difficulty ? null : difficulty)}
          style={{
            padding: '6px 12px',
            backgroundColor:
              selectedDifficulty === difficulty
                ? difficulty === 'beginner'
                  ? '#28a745'
                  : difficulty === 'intermediate'
                    ? '#ffc107'
                    : '#dc3545'
                : '#f0f0f0',
            color: selectedDifficulty === difficulty ? 'white' : 'black',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'capitalize',
          }}
        >
          {difficulty}
        </button>
      ))}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: 'white',
      }}
    >
      {/* Main gallery */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ margin: 0 }}>Railway Templates</h2>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          />

          {/* Category filter */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              Category:
            </div>
            {renderCategoryFilter()}
          </div>

          {/* Difficulty filter */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              Difficulty:
            </div>
            {renderDifficultyFilter()}
          </div>
        </div>

        {/* Template grid */}
        {filteredTemplates.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(200px, 1fr))'
                  : '1fr',
              gap: '16px',
            }}
          >
            {filteredTemplates.map(tmpl => renderTemplateCard(tmpl))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
            No templates found
          </div>
        )}
      </div>

      {/* Preview panel */}
      {previewTemplate && (
        <div
          style={{
            width: '300px',
            backgroundColor: '#f9f9f9',
            borderLeft: '1px solid #ddd',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{previewTemplate.name}</h3>
          <p style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
            {previewTemplate.description}
          </p>

          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <strong>Category:</strong> {previewTemplate.category}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <strong>Difficulty:</strong> {previewTemplate.difficulty}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <strong>Elements:</strong> {previewTemplate.elements.length}
            </div>
            {previewTemplate.connections && (
              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                <strong>Connections:</strong> {previewTemplate.connections.length}
              </div>
            )}
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              Tags:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {previewTemplate.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: '#e7f3ff',
                    color: '#004085',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    fontSize: '11px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Use button */}
          <button
            onClick={() => handleSelectTemplate(previewTemplate)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Use This Template
          </button>
        </div>
      )}
    </div>
  );
};
