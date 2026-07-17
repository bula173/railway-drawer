/**
 * @file MaxGraphAdvancedDemo.tsx
 * @brief Advanced demo showcasing all maxGraph features
 *
 * Demonstrates:
 * - Interactive editing with vertices and edges
 * - Grouping and nesting
 * - Native undo/redo
 * - Event system
 * - Alignment and distribution
 * - Keyboard shortcuts
 * - Copy/paste
 * - Zoom and pan
 */

import React, { useRef, useState } from 'react';
import { MaxGraphDrawingArea, type MaxGraphDrawingAreaRef } from './MaxGraphDrawingArea';
import type { Cell } from '@maxgraph/core';
import './styles/maxGraphAdvancedDemo.css';

export const MaxGraphAdvancedDemo: React.FC = () => {
  const drawingAreaRef = useRef<MaxGraphDrawingAreaRef>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [cellCount, setCellCount] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev.slice(0, 9),
    ]);
  };

  const handleAddVertex = () => {
    const cell = drawingAreaRef.current?.addVertex(50, 50, 100, 60, undefined, 'New Shape');
    if (cell) {
      addLog(`✓ Added vertex: ${cell.getId()}`);
      setCellCount((c) => c + 1);
    }
  };

  const handleAddEdge = () => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length >= 2) {
      const edge = drawingAreaRef.current?.addEdge(selected[0], selected[1], undefined, 'Connection');
      if (edge) {
        addLog(`✓ Connected: ${selected[0].getId()} → ${selected[1].getId()}`);
        setCellCount((c) => c + 1);
      }
    } else {
      addLog('⚠ Select 2 shapes to create connection');
    }
  };

  const handleGroup = () => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 1) {
      const group = drawingAreaRef.current?.groupCells(selected);
      if (group) {
        addLog(`✓ Grouped ${selected.length} cells`);
      }
    } else {
      addLog('⚠ Select 2+ shapes to group');
    }
  };

  const handleUngroup = () => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 0) {
      drawingAreaRef.current?.ungroupCells(selected);
      addLog(`✓ Ungrouped ${selected.length} cells`);
    }
  };

  const handleAlign = (align: string) => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 1) {
      drawingAreaRef.current?.alignCells(selected, align);
      addLog(`✓ Aligned ${selected.length} cells: ${align}`);
    } else {
      addLog('⚠ Select 2+ shapes to align');
    }
  };

  const handleDistribute = (direction: 'h' | 'v') => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 2) {
      drawingAreaRef.current?.distributeCells(selected, direction);
      addLog(`✓ Distributed ${selected.length} cells: ${direction}`);
    } else {
      addLog('⚠ Select 3+ shapes to distribute');
    }
  };

  const handleZoom = (level: number) => {
    drawingAreaRef.current?.setZoom(level / 100);
    setZoom(level);
    addLog(`🔍 Zoom: ${level}%`);
  };

  const handleUndo = () => {
    if (drawingAreaRef.current?.canUndo()) {
      drawingAreaRef.current?.undo();
      addLog('↶ Undo');
    }
  };

  const handleRedo = () => {
    if (drawingAreaRef.current?.canRedo()) {
      drawingAreaRef.current?.redo();
      addLog('↷ Redo');
    }
  };

  const handleCopy = () => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 0) {
      drawingAreaRef.current?.copy();
      addLog(`📋 Copied ${selected.length} cells`);
    }
  };

  const handlePaste = () => {
    drawingAreaRef.current?.paste();
    addLog('📌 Pasted');
  };

  const handleDelete = () => {
    const selected = drawingAreaRef.current?.getSelectedCells();
    if (selected && selected.length > 0) {
      drawingAreaRef.current?.deleteCells(selected);
      addLog(`🗑 Deleted ${selected.length} cells`);
      setCellCount((c) => Math.max(0, c - selected.length));
    }
  };

  const handleSelectAll = () => {
    const graph = drawingAreaRef.current?.getGraph();
    if (graph) {
      graph.selectAll();
      setSelectedCount(drawingAreaRef.current?.getSelectedCells().length || 0);
      addLog('✓ Selected all cells');
    }
  };

  const handleClearSelection = () => {
    drawingAreaRef.current?.clearSelection();
    setSelectedCount(0);
    addLog('✓ Cleared selection');
  };

  const handleExportJson = () => {
    const json = drawingAreaRef.current?.getJson();
    if (json) {
      console.log('Exported JSON:', json);
      addLog(`💾 Exported ${json.cells?.length || 0} cells`);
    }
  };

  return (
    <div className="maxgraph-advanced-demo">
      <div className="demo-header">
        <h1>maxGraph Advanced Features Demo</h1>
        <p>Interactive editing, grouping, undo/redo, events, alignment, keyboard shortcuts</p>
      </div>

      <div className="demo-layout">
        {/* Toolbar */}
        <div className="toolbar">
          <section className="toolbar-section">
            <h3>Creation</h3>
            <button onClick={handleAddVertex} className="btn btn-primary">
              Add Shape
            </button>
            <button onClick={handleAddEdge} className="btn btn-primary">
              Connect
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Grouping</h3>
            <button onClick={handleGroup} className="btn btn-secondary">
              Group
            </button>
            <button onClick={handleUngroup} className="btn btn-secondary">
              Ungroup
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Alignment</h3>
            <div className="align-grid">
              <button onClick={() => handleAlign('left')} title="Align left">
                ⬅️
              </button>
              <button onClick={() => handleAlign('center')} title="Align center H">
                ↔️
              </button>
              <button onClick={() => handleAlign('right')} title="Align right">
                ➡️
              </button>
            </div>
            <div className="align-grid">
              <button onClick={() => handleAlign('top')} title="Align top">
                ⬆️
              </button>
              <button onClick={() => handleAlign('middle')} title="Align middle V">
                ↕️
              </button>
              <button onClick={() => handleAlign('bottom')} title="Align bottom">
                ⬇️
              </button>
            </div>
          </section>

          <section className="toolbar-section">
            <h3>Distribution</h3>
            <button onClick={() => handleDistribute('h')} className="btn btn-secondary">
              Distribute H
            </button>
            <button onClick={() => handleDistribute('v')} className="btn btn-secondary">
              Distribute V
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Editing</h3>
            <button onClick={handleUndo} className="btn" disabled={!drawingAreaRef.current?.canUndo()}>
              ↶ Undo
            </button>
            <button onClick={handleRedo} className="btn" disabled={!drawingAreaRef.current?.canRedo()}>
              ↷ Redo
            </button>
            <button onClick={handleCopy} className="btn btn-secondary">
              Copy
            </button>
            <button onClick={handlePaste} className="btn btn-secondary">
              Paste
            </button>
            <button onClick={handleDelete} className="btn btn-danger">
              Delete
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Zoom</h3>
            <div className="zoom-controls">
              <button onClick={() => handleZoom(50)}>50%</button>
              <button onClick={() => handleZoom(75)}>75%</button>
              <button onClick={() => handleZoom(100)} className={zoom === 100 ? 'active' : ''}>
                100%
              </button>
              <button onClick={() => handleZoom(150)}>150%</button>
              <button onClick={() => handleZoom(200)}>200%</button>
            </div>
            <button onClick={() => drawingAreaRef.current?.fitWindow()} className="btn btn-secondary">
              Fit Window
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Selection</h3>
            <button onClick={handleSelectAll} className="btn btn-secondary">
              Select All
            </button>
            <button onClick={handleClearSelection} className="btn btn-secondary">
              Clear
            </button>
          </section>

          <section className="toolbar-section">
            <h3>Export</h3>
            <button onClick={handleExportJson} className="btn btn-secondary">
              Export JSON
            </button>
          </section>
        </div>

        {/* Drawing Area */}
        <div className="drawing-section">
          <MaxGraphDrawingArea
            ref={drawingAreaRef}
            backgroundColor="#ffffff"
            gridSize={40}
            enableGrid={true}
            snapToGrid={true}
            connectable={true}
            editable={true}
            onSelectionChanged={(cells) => {
              setSelectedCount(cells.length);
              addLog(`📍 Selected: ${cells.length} cell(s)`);
            }}
            onDoubleClick={(cell) => {
              if (cell) {
                drawingAreaRef.current?.editCell(cell);
                addLog(`✏️ Editing: ${cell.getValue?.() || cell.getId?.()}`);
              }
            }}
            onCellsChanged={(cells) => {
              setCellCount((c) => Math.max(c, c + cells.length));
            }}
            onEdgeConnected={(edge) => {
              addLog(`🔗 Edge connected: ${edge.getId?.()}`);
            }}
          />
        </div>

        {/* Info Panel */}
        <div className="info-panel">
          <section className="info-section">
            <h3>Statistics</h3>
            <div className="stat-item">
              <span className="label">Total Cells:</span>
              <span className="value">{cellCount}</span>
            </div>
            <div className="stat-item">
              <span className="label">Selected:</span>
              <span className="value">{selectedCount}</span>
            </div>
            <div className="stat-item">
              <span className="label">Zoom:</span>
              <span className="value">{zoom}%</span>
            </div>
          </section>

          <section className="info-section">
            <h3>Event Log</h3>
            <div className="log-container">
              {logs.length === 0 ? (
                <div className="log-empty">No events</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="log-item">
                    {log}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="info-section">
            <h3>Keyboard Shortcuts</h3>
            <ul className="shortcuts-list">
              <li>
                <kbd>Ctrl+Z</kbd> Undo
              </li>
              <li>
                <kbd>Ctrl+Y</kbd> Redo
              </li>
              <li>
                <kbd>Ctrl+C</kbd> Copy
              </li>
              <li>
                <kbd>Ctrl+X</kbd> Cut
              </li>
              <li>
                <kbd>Ctrl+V</kbd> Paste
              </li>
              <li>
                <kbd>Ctrl+A</kbd> Select All
              </li>
              <li>
                <kbd>Ctrl+G</kbd> Group
              </li>
              <li>
                <kbd>Ctrl+Shift+G</kbd> Ungroup
              </li>
              <li>
                <kbd>Ctrl+D</kbd> Duplicate
              </li>
              <li>
                <kbd>Delete</kbd> Delete Selected
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

MaxGraphAdvancedDemo.displayName = 'MaxGraphAdvancedDemo';
