/**
 * @file MaxGraphTabIntegration.tsx
 * @brief Integration layer for maxGraph tabs in TabPanel
 *
 * Replaces DrawArea with MaxGraphEditorCore while maintaining TabPanel API
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Graph } from '@maxgraph/core';
import { MaxGraphEditorCore, type MaxGraphEditorCoreRef } from './MaxGraphEditorCore';
import { MaxGraphPropertiesPanel } from './MaxGraphPropertiesPanel';
import { TopToolbar } from './TopToolbar';
import type { ToolboxItem } from './Toolbox';
import { shapeManager } from '../utils/maxGraphShapeManager';
import { setupMaxGraphDragDrop, getDropPosition } from '../utils/maxGraphDragDrop';
import { logger } from '../utils/logger';
import './styles/maxGraphTabIntegration.css';

export interface MaxGraphTabIntegrationProps {
  tabId: string;
  tabName: string;
  toolboxItems: ToolboxItem[];
  backgroundColor?: string;
  gridSize?: number;
  enableGrid?: boolean;
  snapToGrid?: boolean;
  onModelChange?: (xml: string) => void;
  onSelectionChange?: (cellIds: string[]) => void;
}

export const MaxGraphTabIntegration: React.FC<MaxGraphTabIntegrationProps> = ({
  tabId,
  tabName,
  toolboxItems,
  backgroundColor = '#ffffff',
  gridSize = 40,
  enableGrid = true,
  snapToGrid = true,
  onModelChange,
  onSelectionChange,
}) => {
  const editorRef = useRef<MaxGraphEditorCoreRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [zoom, setZoom] = useState(100);

  // Initialize shape manager
  useEffect(() => {
    shapeManager.registerShapes(toolboxItems);
  }, [toolboxItems]);

  // Set up graph reference and drag-drop
  useEffect(() => {
    if (!editorRef.current || !containerRef.current) return;

    // Get graph from editor (need to expose it)
    // For now, set up drag-drop handlers
    const handleDrop = (item: ToolboxItem, x: number, y: number) => {
      try {
        editorRef.current?.addShape(item, x, y);
        logger.debug('MaxGraphTabIntegration', 'Shape added from toolbox', {
          shapeId: item.id,
          x,
          y,
        });
      } catch (error) {
        logger.error('MaxGraphTabIntegration', 'Failed to add shape', { error });
      }
    };

    setupMaxGraphDragDrop(graphRef.current!, containerRef.current, handleDrop);
  }, []);

  // Handle zoom changes
  const handleZoom = useCallback((scale: number) => {
    editorRef.current?.setZoom(scale / 100);
    setZoom(scale);
  }, []);

  const handleZoomIn = useCallback(() => {
    editorRef.current?.zoomIn();
    setZoom((z) => z + 10);
  }, []);

  const handleZoomOut = useCallback(() => {
    editorRef.current?.zoomOut();
    setZoom((z) => Math.max(10, z - 10));
  }, []);

  const handleFitWindow = useCallback(() => {
    editorRef.current?.fitWindow();
    setZoom(100);
  }, []);

  const handleSelectAll = useCallback(() => {
    editorRef.current?.selectAll();
  }, []);

  const handleDelete = useCallback(() => {
    editorRef.current?.deleteSelected();
  }, []);

  const handleCopy = useCallback(() => {
    editorRef.current?.copy();
  }, []);

  const handlePaste = useCallback(() => {
    editorRef.current?.paste();
  }, []);

  const handleUndo = useCallback(() => {
    editorRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.redo();
  }, []);

  return (
    <div className="maxgraph-tab-integration">
      <TopToolbar
        zoom={zoom}
        onZoom={handleZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWindow={handleFitWindow}
        onSelectAll={handleSelectAll}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={editorRef.current?.canUndo() || false}
        canRedo={editorRef.current?.canRedo() || false}
      />

      <div className="tab-content">
        <div className="editor-container" ref={containerRef}>
          <MaxGraphEditorCore
            ref={editorRef}
            backgroundColor={backgroundColor}
            gridSize={gridSize}
            enableGrid={enableGrid}
            snapToGrid={snapToGrid}
            onModelChange={onModelChange}
          />
        </div>

        <MaxGraphPropertiesPanel
          selectedCell={selectedCell}
          onStyleChange={() => {
            onModelChange?.(editorRef.current?.getXml() || '');
          }}
        />
      </div>
    </div>
  );
};

MaxGraphTabIntegration.displayName = 'MaxGraphTabIntegration';
