/**
 * @file ShapeComposerDialog.tsx
 * @brief Main shape composer dialog component
 *
 * Orchestrates the shape composition workflow with visual editor and properties panel
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, Save, Download, Upload, Plus } from 'lucide-react';
import { ComposedShape, PrimitiveElement } from '../../types/shapeComposer';
import { shapeLibraryManager } from '../../utils/shapeLibraryManager';
import { generateToolboxItem } from '../../utils/shapeComposerSvgGenerator';
import { ComposerCanvas } from './ComposerCanvas';
import { PrimitiveToolbox } from './PrimitiveToolbox';
import { ElementsList } from './ElementsList';
import { PrimitivePropertiesEditor } from './PrimitivePropertiesEditor';
import './styles/shapeComposerDialog.css';
import { logger } from '../../utils/logger';

export interface ShapeComposerDialogProps {
  shape?: ComposedShape;
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (shape: ComposedShape) => void;
  onCancel?: () => void;
}

/**
 * Main shape composer dialog
 */
export const ShapeComposerDialog: React.FC<ShapeComposerDialogProps> = ({
  shape: initialShape,
  isOpen = false,
  onClose,
  onSave,
  onCancel,
}) => {
  // Initialize with empty shape or provided shape
  const defaultShape: ComposedShape = useMemo(
    () =>
      initialShape || {
        id: `shape_${Date.now()}`,
        name: 'New Shape',
        elements: [],
        width: 400,
        height: 300,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    [initialShape]
  );

  const [shape, setShape] = useState<ComposedShape>(defaultShape);
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>();
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const selectedElement = useMemo(
    () => shape.elements.find(el => el.id === selectedElementId),
    [shape.elements, selectedElementId]
  );

  // Add primitive
  const handleAddPrimitive = useCallback((element: PrimitiveElement) => {
    setShape(prev => ({
      ...prev,
      elements: [...prev.elements, element],
      updatedAt: Date.now(),
    }));
    setSelectedElementId(element.id);
  }, []);

  // Delete primitive
  const handleDeleteElement = useCallback((id: string) => {
    setShape(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
      updatedAt: Date.now(),
    }));
    if (selectedElementId === id) {
      setSelectedElementId(undefined);
    }
  }, [selectedElementId]);

  // Update primitive
  const handleUpdateElement = useCallback((id: string, updates: Partial<PrimitiveElement>) => {
    setShape(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === id ? { ...el, ...updates } : el
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  // Move element (z-index)
  const handleMoveElement = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setShape(prev => {
        const elements = [...prev.elements];
        const index = elements.findIndex(el => el.id === id);
        if (index === -1) return prev;

        if (direction === 'up' && index < elements.length - 1) {
          const newZ = (elements[index].zIndex || 0) + 1;
          elements[index].zIndex = newZ;
        } else if (direction === 'down' && index > 0) {
          const newZ = Math.max((elements[index].zIndex || 0) - 1, 0);
          elements[index].zIndex = newZ;
        }

        return {
          ...prev,
          elements,
          updatedAt: Date.now(),
        };
      });
    },
    []
  );

  // Save shape
  const handleSave = useCallback(async () => {
    if (!shape.name.trim()) {
      alert('Please enter a shape name');
      return;
    }

    try {
      if (shape.id.startsWith('shape_') && !initialShape) {
        // New shape
        const saved = shapeLibraryManager.createShape(shape);
        logger.debug('ShapeComposerDialog', 'Shape saved', {
          id: saved.id,
          name: saved.name,
        });
        onSave?.(saved);
      } else {
        // Update existing
        const updated = shapeLibraryManager.updateShape(shape.id, shape);
        onSave?.(updated);
      }
      onClose?.();
    } catch (error) {
      logger.error('ShapeComposerDialog', 'Failed to save shape', { error });
      alert(`Failed to save shape: ${error}`);
    }
  }, [shape, initialShape, onSave, onClose]);

  // Export shape
  const handleExport = useCallback(() => {
    try {
      shapeLibraryManager.downloadShapeFile(shape.id, `${shape.name}.json`);
      logger.debug('ShapeComposerDialog', 'Shape exported', {
        name: shape.name,
      });
    } catch (error) {
      logger.error('ShapeComposerDialog', 'Failed to export shape', { error });
      alert(`Failed to export shape: ${error}`);
    }
  }, [shape.id, shape.name]);

  if (!isOpen) return null;

  return (
    <div className="shape-composer-overlay">
      <div className="shape-composer-dialog">
        {/* Header */}
        <div className="composer-header">
          <div className="header-title">
            <h2>Shape Composer</h2>
            <input
              type="text"
              className="shape-name-input"
              value={shape.name}
              onChange={e =>
                setShape(prev => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Shape name"
            />
          </div>
          <button
            className="close-button"
            onClick={onCancel}
            title="Close without saving"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className="composer-content">
          {/* Canvas area (left) */}
          <div className="canvas-section">
            <div className="canvas-toolbar">
              <div className="toolbar-group">
                <label>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={e => setShowGrid(e.target.checked)}
                  />
                  Grid
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={e => setSnapToGrid(e.target.checked)}
                  />
                  Snap
                </label>
              </div>
              <div className="toolbar-group">
                <label>Zoom:</label>
                <select
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                >
                  <option value={0.5}>50%</option>
                  <option value={0.75}>75%</option>
                  <option value={1}>100%</option>
                  <option value={1.5}>150%</option>
                  <option value={2}>200%</option>
                </select>
              </div>
            </div>
            <ComposerCanvas
              shape={shape}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              zoom={zoom}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
            />
          </div>

          {/* Right sidebar */}
          <div className="sidebar">
            {/* Toolbox */}
            <PrimitiveToolbox onAddPrimitive={handleAddPrimitive} />

            {/* Properties editor */}
            <PrimitivePropertiesEditor
              element={selectedElement}
              onUpdate={updates => {
                if (selectedElementId) {
                  handleUpdateElement(selectedElementId, updates);
                }
              }}
            />

            {/* Elements list */}
            <ElementsList
              shape={shape}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onDeleteElement={handleDeleteElement}
              onMoveElement={handleMoveElement}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="composer-footer">
          <div className="status-info">
            <span>{shape.elements.length} elements</span>
            <span>{shape.width} × {shape.height}px</span>
          </div>
          <div className="footer-buttons">
            <button
              className="button secondary"
              onClick={handleExport}
              title="Download shape as JSON"
            >
              <Download size={16} />
              Export
            </button>
            <button
              className="button secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={handleSave}
              title="Save shape to library"
            >
              <Save size={16} />
              Save Shape
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
