/**
 * @file MxGraphEditorPanel.tsx
 * @brief Integrated editor panel with mxGraph + toolbox
 *
 * Combines:
 * - MxGraphEditor (left)
 * - ToolboxDrawIO (right)
 * - Drag-drop integration
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MxGraphEditor, type MxGraphEditorRef } from './MxGraphEditor';
import { ToolboxDrawIO } from './ToolboxDrawIO';
import { logger } from '../utils/logger';
import { addShapeToGraph } from '../utils/shapeLibraryMxGraph';
import type { ToolboxItem } from './Toolbox';
import './styles/mxgraphEditorPanel.css';

export interface MxGraphEditorPanelProps {
  initialXml?: string;
  onSave?: (xml: string) => void;
  items?: ToolboxItem[];
}

/**
 * Integrated editor panel with toolbox
 */
export const MxGraphEditorPanel: React.FC<MxGraphEditorPanelProps> = ({
  initialXml,
  onSave,
  items = [],
}) => {
  const editorRef = useRef<MxGraphEditorRef>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mxGraph, setMxGraph] = useState<any>(null);
  const [draggedItem, setDraggedItem] = useState<ToolboxItem | null>(null);

  // Get mxGraph instance when editor is ready
  useEffect(() => {
    // This would need to be exposed from MxGraphEditor via ref
    // For now, we'll use a different approach
  }, []);

  // Handle drag from toolbox
  const handleToolboxDragStart = useCallback((e: React.DragEvent, item: ToolboxItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/mxgraph-item', JSON.stringify(item));
    logger.debug('MxGraphEditorPanel', 'Item drag started', {
      itemId: item.id,
      itemName: item.name,
    });
  }, []);

  // Handle drop on canvas
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = e.dataTransfer.getData('application/mxgraph-item');
      if (!data) return;

      const item = JSON.parse(data);
      setDraggedItem(null);

      logger.debug('MxGraphEditorPanel', 'Item dropped on canvas', {
        itemId: item.id,
        x: e.clientX,
        y: e.clientY,
      });

      // Add shape to mxGraph
      if (editorRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / 1; // TODO: get actual zoom from editor
        const y = (e.clientY - rect.top) / 1;

        // This would need proper mxGraph instance access
        // For now, we'll call editor method
        if (typeof (editorRef.current as any).addShapeAtPosition === 'function') {
          (editorRef.current as any).addShapeAtPosition(item, x, y);
        }
      }
    } catch (error) {
      logger.error('MxGraphEditorPanel', 'Failed to handle drop', { error });
    }
  }, []);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    // Only leave if not over child elements
    if (e.currentTarget === e.target) {
      setDraggedItem(null);
    }
  }, []);

  return (
    <div className="mxgraph-editor-panel">
      {/* Editor */}
      <div
        className="editor-container"
        ref={canvasRef}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        onDragLeave={handleCanvasDragLeave}
        style={{
          opacity: draggedItem ? 0.8 : 1,
        }}
      >
        <MxGraphEditor
          ref={editorRef}
          initialXml={initialXml}
          onSave={onSave}
        />
      </div>

      {/* Toolbox */}
      <div className="toolbox-container">
        <ToolboxDrawIO
          items={items}
          onDragStart={handleToolboxDragStart}
        />
      </div>

      {/* Drag indicator */}
      {draggedItem && (
        <div className="drag-indicator">
          <div className="drag-indicator-content">
            Drop to add: <strong>{draggedItem.name}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
