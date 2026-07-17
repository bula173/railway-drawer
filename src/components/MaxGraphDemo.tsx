/**
 * @file MaxGraphDemo.tsx
 * @brief Demo component showcasing maxGraph system
 *
 * Phase 8: Comprehensive demonstration
 */

import React, { useRef, useState } from 'react';
import { MaxGraphEditorCore, type MaxGraphEditorCoreRef } from './MaxGraphEditorCore';
import { MaxGraphPropertiesPanel } from './MaxGraphPropertiesPanel';
import { MaxGraphFileDialog } from './MaxGraphFileDialog';
import type { ToolboxItem } from './Toolbox';
import { logger } from '../utils/logger';
import './styles/maxGraphDemo.css';

const DEMO_SHAPES: ToolboxItem[] = [
  {
    id: 'rect',
    name: 'Rectangle',
    type: 'custom',
    group: 'General',
    width: 100,
    height: 60,
    dimensionality: '2D',
    shapeElements: [],
  },
  {
    id: 'circle',
    name: 'Circle',
    type: 'custom',
    group: 'General',
    width: 80,
    height: 80,
    dimensionality: '2D',
    shapeElements: [],
  },
  {
    id: 'signal',
    name: 'Signal',
    type: 'rail',
    group: 'ERTMS',
    width: 40,
    height: 60,
    dimensionality: '1D',
    shapeElements: [],
  },
];

export const MaxGraphDemo: React.FC = () => {
  const editorRef = useRef<MaxGraphEditorCoreRef>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [modelXml, setModelXml] = useState('');

  const handleAddShape = (shape: ToolboxItem) => {
    try {
      editorRef.current?.addShape(shape, 50, 50);
      logger.debug('MaxGraphDemo', 'Shape added', { shapeId: shape.id });
    } catch (error) {
      logger.error('MaxGraphDemo', 'Failed to add shape', { error });
    }
  };

  const handleModelChange = (xml: string) => {
    setModelXml(xml);
  };

  return (
    <div className="maxgraph-demo">
      <div className="demo-header">
        <h1>maxGraph Integration Demo</h1>
        <p>Professional diagram editor powered by maxGraph</p>
      </div>

      <div className="demo-container">
        <div className="sidebar">
          <div className="panel">
            <h3>Shapes</h3>
            <div className="shape-list">
              {DEMO_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  className="shape-button"
                  onClick={() => handleAddShape(shape)}
                  title={`Add ${shape.name}`}
                >
                  {shape.name}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Actions</h3>
            <div className="action-list">
              <button
                className="action-button"
                onClick={() => editorRef.current?.undo()}
                disabled={!editorRef.current?.canUndo()}
              >
                ↶ Undo
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.redo()}
                disabled={!editorRef.current?.canRedo()}
              >
                ↷ Redo
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.selectAll()}
              >
                ✓ Select All
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.copy()}
              >
                ⎘ Copy
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.paste()}
              >
                ⎙ Paste
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.zoomIn()}
              >
                 + Zoom In
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.zoomOut()}
              >
                − Zoom Out
              </button>
              <button
                className="action-button"
                onClick={() => editorRef.current?.fitWindow()}
              >
                ◻ Fit
              </button>
            </div>
          </div>

          <div className="panel">
            <h3>File</h3>
            <button
              className="file-button primary"
              onClick={() => setFileDialogOpen(true)}
            >
              Open File Dialog
            </button>
          </div>

          <div className="panel info">
            <h3>Info</h3>
            <p>
              <strong>maxGraph Version:</strong> @maxgraph/core v0.24.0
            </p>
            <p>
              <strong>Features:</strong>
              <ul>
                <li>Drag-drop shapes</li>
                <li>Undo/redo</li>
                <li>Copy/paste</li>
                <li>Zoom & pan</li>
                <li>Alignment</li>
                <li>Properties editing</li>
                <li>File I/O</li>
              </ul>
            </p>
          </div>
        </div>

        <div className="main-content">
          <div className="editor-wrapper">
            <MaxGraphEditorCore
              ref={editorRef}
              backgroundColor="#ffffff"
              gridSize={40}
              enableGrid={true}
              snapToGrid={true}
              onModelChange={handleModelChange}
            />
          </div>

          <MaxGraphPropertiesPanel
            selectedCell={selectedCell}
            onStyleChange={(cell, style) => {
              setSelectedCell(cell);
            }}
          />
        </div>
      </div>

      <MaxGraphFileDialog
        graph={editorRef.current as any}
        isOpen={fileDialogOpen}
        onClose={() => setFileDialogOpen(false)}
        currentFileName="Demo Drawing"
      />

      <div className="demo-footer">
        <p>
          ← Use shape buttons to add elements | Click canvas to select | Press Delete to remove
        </p>
      </div>
    </div>
  );
};

MaxGraphDemo.displayName = 'MaxGraphDemo';
