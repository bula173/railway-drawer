/**
 * @file RailwayDrawerMaxGraphApp.tsx
 * @brief Railway Drawer using maxGraph with embedded shapes only
 *
 * Architecture:
 * - MaxGraph Editor for core diagramming
 * - Built-in shape library (rectangles, circles, lines, etc.)
 * - Drag-and-drop from palette to canvas
 * - Basic toolbar with undo/redo
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Graph, Editor } from '@maxgraph/core';
import './styles/railwayDrawerMaxGraphApp.css';

interface RailwayDrawerAppState {
  dirty: boolean;
  selectedCells: number;
  cellCount: number;
  zoom: number;
  undoCount: number;
  redoCount: number;
}

interface SelectedCellProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  label?: string;
}

/**
 * Railway Drawer Application built entirely on maxGraph
 */
export const RailwayDrawerMaxGraphApp: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RailwayDrawerAppState>({
    dirty: false,
    selectedCells: 0,
    cellCount: 0,
    zoom: 100,
    undoCount: 0,
    redoCount: 0,
  });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [selectedProps, setSelectedProps] = useState<SelectedCellProps>({});

  // Initialize maxGraph Editor with configuration
  useEffect(() => {
    console.log('🔧 useEffect running - initializing editor');
    console.log('Refs:', {
      container: !!containerRef.current,
      toolbar: !!toolbarContainerRef.current,
      canvas: !!canvasRef.current,
      palette: !!paletteRef.current
    });

    if (!containerRef.current) {
      console.error('❌ containerRef not ready');
      return;
    }

    const initializeEditor = async () => {
      try {
        console.log('📥 Creating maxGraph Graph');
        const graphContainer = canvasRef.current;
        if (!graphContainer) {
          console.error('❌ Graph container not available');
          return;
        }

        graphContainer.style.width = '100%';
        graphContainer.style.height = '100%';
        graphContainer.style.position = 'relative';
        graphContainer.style.overflow = 'hidden';

        // Create graph directly
        const graph = new Graph(graphContainer);
        console.log('✅ Graph created');

        // Store graph in editor-like object
        const editor = { graph, undoManager: graph.undoManager } as any;
        editorRef.current = editor;

        // Setup selection listener
        graph.addListener('selectionChange', () => {
          const selected = graph.getSelectionCells();
          console.log('Selection changed:', selected.length);
          setState((s) => ({ ...s, selectedCells: selected.length }));

          if (selected.length === 1) {
            const cell = selected[0];
            setSelectedCell(cell);
            setSelectedProps({
              width: cell.geometry?.width,
              height: cell.geometry?.height,
              x: cell.geometry?.x,
              y: cell.geometry?.y,
              label: cell.value,
              fillColor: cell.style?.split('fillColor=')[1]?.split(';')[0] || '#ffffff',
              strokeColor: cell.style?.split('strokeColor=')[1]?.split(';')[0] || '#000000',
            });
          } else {
            setSelectedCell(null);
            setSelectedProps({});
          }
        });

        // Setup toolbar
        setupToolbar(editor);

        // Setup palette with embedded shapes
        setupPalette(editor);

        // Setup canvas drop zone
        setupCanvasDropZone(editor, graphContainer);

        // Update status bar
        updateStatusBar(graph);
        graph.addListener('change', () => updateStatusBar(graph));

        console.log('✅ Initialization complete');
      } catch (error) {
        console.error('❌ Failed to initialize editor:', error);
      }
    };

    initializeEditor();

    return () => {
      editorRef.current?.destroy?.();
    };
  }, []);

  const setupToolbar = (editor: Editor) => {
    const toolbar = toolbarContainerRef.current;
    if (!toolbar) return;

    const buttons = [
      { label: 'Undo', action: 'undo', title: 'Undo (Ctrl+Z)' },
      { label: 'Redo', action: 'redo', title: 'Redo (Ctrl+Y)' },
      { type: 'separator' },
      { label: 'Copy', action: 'copy', title: 'Copy (Ctrl+C)' },
      { label: 'Paste', action: 'paste', title: 'Paste (Ctrl+V)' },
      { label: 'Delete', action: 'delete', title: 'Delete' },
      { type: 'separator' },
      { label: 'Zoom In', action: 'zoomIn', title: 'Zoom In' },
      { label: 'Zoom Out', action: 'zoomOut', title: 'Zoom Out' },
      { label: 'Fit', action: 'fit', title: 'Fit to Window' },
    ];

    toolbar.innerHTML = '';
    buttons.forEach(btn => {
      if (btn.type === 'separator') {
        const sep = document.createElement('span');
        sep.style.cssText = 'border-left: 1px solid #ddd; height: 20px; margin: 0 4px;';
        toolbar.appendChild(sep);
      } else {
        const button = document.createElement('button');
        button.textContent = btn.label;
        button.title = btn.title;
        button.style.cssText = `
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 3px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        `;

        button.addEventListener('mouseenter', () => {
          button.style.background = '#f0f0f0';
          button.style.borderColor = '#1976d2';
        });

        button.addEventListener('mouseleave', () => {
          button.style.background = 'white';
          button.style.borderColor = '#ddd';
        });

        button.addEventListener('click', () => {
          const graph = editor.graph;
          if (btn.action === 'undo' && editor.undoManager) {
            editor.undoManager.undo();
          } else if (btn.action === 'redo' && editor.undoManager) {
            editor.undoManager.redo();
          } else if (btn.action === 'delete' && graph) {
            graph.removeCells();
          } else if (btn.action === 'zoomIn' && graph) {
            graph.zoomIn();
          } else if (btn.action === 'zoomOut' && graph) {
            graph.zoomOut();
          } else if (btn.action === 'fit' && graph) {
            graph.fit();
          }
        });

        toolbar.appendChild(button);
      }
    });

    console.log('✅ Toolbar created');
  };

  const setupPalette = (editor: Editor) => {
    try {
      console.log('setupPalette called, paletteRef:', paletteRef.current);
      if (!paletteRef.current || !editor.graph) {
        console.warn('❌ Palette or editor not ready', {
          palette: !!paletteRef.current,
          graph: !!editor.graph
        });
        return;
      }

      const palette = paletteRef.current;

      console.log('📦 Creating palette with responsive grid layout');
      palette.innerHTML = '';

      const header = document.createElement('div');
      header.style.cssText = 'padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd; color: #333; font-size: 13px; position: sticky; top: 0; background: white; z-index: 10;';
      header.textContent = 'Shapes';
      palette.appendChild(header);

      // Create responsive grid container
      const gridContainer = document.createElement('div');
      gridContainer.className = 'railway-palette-grid';
      palette.appendChild(gridContainer);

      // Only embedded maxGraph shapes
      const shapes = [
        { name: 'Rectangle', style: '', group: 'Basic', width: 100, height: 60 },
        { name: 'Square', style: '', group: 'Basic', width: 60, height: 60 },
        { name: 'Circle', style: 'shape=ellipse', group: 'Basic', width: 60, height: 60 },
        { name: 'Ellipse', style: 'shape=ellipse', group: 'Basic', width: 100, height: 60 },
        { name: 'Line', style: 'shape=line', group: 'Basic', width: 100, height: 2 },
        { name: 'Triangle', style: 'shape=triangle', group: 'Basic', width: 60, height: 60 },
        { name: 'Diamond', style: 'shape=rhombus', group: 'Basic', width: 80, height: 80 },
        { name: 'Rounded Rect', style: 'rounded=1', group: 'Basic', width: 100, height: 60 },
      ];

      let currentGroup = '';

      const createShapeIcon = (shapeName: string): SVGSVGElement => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 40 40');
        svg.style.display = 'block';

        const iconColor = '#1976d2';

        switch (shapeName) {
          case 'Rectangle':
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', '8');
            rect.setAttribute('y', '12');
            rect.setAttribute('width', '24');
            rect.setAttribute('height', '16');
            rect.setAttribute('fill', 'none');
            rect.setAttribute('stroke', iconColor);
            rect.setAttribute('stroke-width', '2');
            svg.appendChild(rect);
            break;
          case 'Square':
            const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            sq.setAttribute('x', '12');
            sq.setAttribute('y', '12');
            sq.setAttribute('width', '16');
            sq.setAttribute('height', '16');
            sq.setAttribute('fill', 'none');
            sq.setAttribute('stroke', iconColor);
            sq.setAttribute('stroke-width', '2');
            svg.appendChild(sq);
            break;
          case 'Circle':
          case 'Ellipse':
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '20');
            circle.setAttribute('cy', '20');
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', iconColor);
            circle.setAttribute('stroke-width', '2');
            svg.appendChild(circle);
            break;
          case 'Line':
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '8');
            line.setAttribute('y1', '20');
            line.setAttribute('x2', '32');
            line.setAttribute('y2', '20');
            line.setAttribute('stroke', iconColor);
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
            break;
          case 'Triangle':
            const tri = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            tri.setAttribute('points', '20,8 32,28 8,28');
            tri.setAttribute('fill', 'none');
            tri.setAttribute('stroke', iconColor);
            tri.setAttribute('stroke-width', '2');
            svg.appendChild(tri);
            break;
          case 'Diamond':
            const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            diamond.setAttribute('points', '20,6 34,20 20,34 6,20');
            diamond.setAttribute('fill', 'none');
            diamond.setAttribute('stroke', iconColor);
            diamond.setAttribute('stroke-width', '2');
            svg.appendChild(diamond);
            break;
          case 'Rounded Rect':
            const roundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            roundRect.setAttribute('x', '8');
            roundRect.setAttribute('y', '12');
            roundRect.setAttribute('width', '24');
            roundRect.setAttribute('height', '16');
            roundRect.setAttribute('rx', '3');
            roundRect.setAttribute('ry', '3');
            roundRect.setAttribute('fill', 'none');
            roundRect.setAttribute('stroke', iconColor);
            roundRect.setAttribute('stroke-width', '2');
            svg.appendChild(roundRect);
            break;
        }

        return svg;
      };

      shapes.forEach((shape, index) => {
        // Add group header to grid
        if (currentGroup !== shape.group) {
          currentGroup = shape.group;
          const groupDiv = document.createElement('div');
          groupDiv.className = 'railway-palette-group';
          groupDiv.textContent = shape.group;
          gridContainer.appendChild(groupDiv);
        }

        // Add draggable shape item with icon - responsive grid sizing
        const shapeItem = document.createElement('div');
        shapeItem.draggable = true;
        shapeItem.style.cssText = `
          padding: 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: grab;
          font-size: 11px;
          text-align: center;
          transition: all 0.2s;
          user-select: none;
          color: #333;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          justify-content: center;
          min-height: 80px;
        `;
        shapeItem.id = `shape-${index}`;

        // Add icon
        const icon = createShapeIcon(shape.name);
        shapeItem.appendChild(icon);

        // Add label
        const label = document.createElement('span');
        label.textContent = shape.name;
        label.style.fontSize = '11px';
        label.style.fontWeight = '500';
        shapeItem.appendChild(label);

        // Drag event handlers
        shapeItem.addEventListener('dragstart', (e) => {
          console.log('🎨 Dragging shape:', shape.name);
          const dragData = {
            name: shape.name,
            style: shape.style,
            width: shape.width,
            height: shape.height,
          };
          e.dataTransfer!.effectAllowed = 'copy';
          e.dataTransfer!.setData('application/json', JSON.stringify(dragData));
          shapeItem.style.opacity = '0.5';
          shapeItem.style.cursor = 'grabbing';
        });

        shapeItem.addEventListener('dragend', () => {
          shapeItem.style.opacity = '1';
          shapeItem.style.cursor = 'grab';
        });

        shapeItem.addEventListener('mouseenter', () => {
          shapeItem.style.background = '#f5f5f5';
          shapeItem.style.borderColor = '#1976d2';
          shapeItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });

        shapeItem.addEventListener('mouseleave', () => {
          shapeItem.style.background = 'white';
          shapeItem.style.borderColor = '#ddd';
          shapeItem.style.boxShadow = 'none';
        });

        gridContainer.appendChild(shapeItem);
      });

      // Setup drop handlers on canvas
      setupCanvasDropZone(editor, canvasRef.current!);
    } catch (error) {
      console.error('Palette setup failed:', error);
    }
  };

  const setupCanvasDropZone = (editor: Editor, canvasElement: HTMLElement) => {
    canvasElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
      canvasElement.classList.add('drag-over');
    });

    canvasElement.addEventListener('dragleave', (e) => {
      if (e.target === canvasElement) {
        canvasElement.classList.remove('drag-over');
      }
    });

    canvasElement.addEventListener('drop', (e) => {
      e.preventDefault();
      canvasElement.classList.remove('drag-over');

      try {
        const json = e.dataTransfer!.getData('application/json');
        console.log('📍 Drop event, data:', json);

        if (!json) {
          console.warn('No data in drop event');
          return;
        }

        const shapeData = JSON.parse(json);
        console.log('📍 Parsed shape data:', shapeData);

        if (!editor.graph) {
          console.error('❌ Graph not available');
          return;
        }

        const graph = editor.graph;
        console.log('📍 Graph available:', !!graph);
        console.log('📍 Graph methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(graph)).slice(0, 20));

        const rect = canvasElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        console.log('📍 Drop position:', { x, y });

        try {
          // Try to get parent
          let parent;
          if (typeof graph.getDefaultParent === 'function') {
            parent = graph.getDefaultParent();
            console.log('📍 Using getDefaultParent()');
          } else {
            parent = graph.model.root;
            console.log('📍 Using graph.model.root');
          }
          console.log('📍 Parent:', !!parent);

          // Try different ways to insert vertex
          let cell;
          if (typeof graph.insertVertex === 'function') {
            console.log('📍 Using insertVertex');
            cell = graph.insertVertex(
              parent,
              null,
              shapeData.name,
              x - shapeData.width / 2,
              y - shapeData.height / 2,
              shapeData.width,
              shapeData.height,
              shapeData.style
            );
          } else if (typeof graph.addCell === 'function') {
            console.log('📍 insertVertex not found, trying addCell');
            const Geometry = (window as any).mxGeometry || (window as any).mx?.Geometry;
            const Cell = (window as any).mxCell || (window as any).mx?.Cell;

            if (Cell && Geometry) {
              cell = new Cell(shapeData.name);
              cell.geometry = new Geometry(
                x - shapeData.width / 2,
                y - shapeData.height / 2,
                shapeData.width,
                shapeData.height
              );
              cell.style = shapeData.style;
              cell.vertex = true;
              graph.addCell(cell, parent);
            } else {
              throw new Error('Cell or Geometry constructor not found');
            }
          } else {
            throw new Error('No insertVertex or addCell method found');
          }

          console.log('✅ Vertex created:', cell);

          // Try to select
          if (typeof graph.setSelectionCells === 'function') {
            graph.setSelectionCells([cell]);
          } else if (typeof graph.setSelectionCell === 'function') {
            graph.setSelectionCell(cell);
          }
          console.log('✅ Cell selected');
        } catch (err) {
          console.error('❌ Error creating vertex:', err);
          console.error('Error details:', err);
        }
      } catch (error) {
        console.error('❌ Drop failed:', error);
      }
    });

    console.log('✅ Canvas drop zone initialized');
  };


  const updateStatusBar = (graph: Graph) => {
    const statusBar = document.querySelector('.railway-statusbar') as HTMLElement;
    if (statusBar) {
      const cellCount = graph.model.root ? graph.model.getChildCount(graph.model.root) : 0;
      const zoom = Math.round(graph.getView().getScale() * 100);
      statusBar.innerHTML = `
        <span>Cells: ${cellCount}</span>
        <span class="separator">|</span>
        <span>Selected: ${state.selectedCells}</span>
        <span class="separator">|</span>
        <span>Zoom: ${zoom}%</span>
      `;
    }
  };

  const handleFileMenu = (action: string) => {
    if (!editorRef.current?.graph) return;
    const graph = editorRef.current.graph;

    switch (action) {
      case 'new':
        graph.model.clear();
        setState((s) => ({ ...s, dirty: false }));
        console.log('✅ New diagram created');
        break;
      case 'save':
        handleSave();
        break;
      case 'load':
        handleLoad();
        break;
    }
    setMenuOpen(null);
  };

  const handleEditMenu = (action: string) => {
    if (!editorRef.current?.graph) return;
    const graph = editorRef.current.graph;

    switch (action) {
      case 'undo':
        if (editorRef.current.undoManager?.canUndo()) {
          editorRef.current.undoManager.undo();
          console.log('✅ Undo executed');
        }
        break;
      case 'redo':
        if (editorRef.current.undoManager?.canRedo()) {
          editorRef.current.undoManager.redo();
          console.log('✅ Redo executed');
        }
        break;
      case 'cut':
        const cutCells = graph.getSelectionCells();
        if (cutCells.length > 0) {
          graph.removeCells(cutCells);
          console.log('✅ Cut executed');
        }
        break;
      case 'copy':
        console.log('Copy not implemented yet');
        break;
      case 'paste':
        console.log('Paste not implemented yet');
        break;
      case 'selectAll':
        graph.selectAll();
        console.log('✅ All cells selected');
        break;
    }
    setMenuOpen(null);
  };

  const handleSave = useCallback(() => {
    if (!editorRef.current?.graph) return;
    console.log('Save not implemented yet');
  }, []);

  const handleLoad = useCallback(() => {
    if (!editorRef.current?.graph) return;
    console.log('Load not implemented yet');
  }, []);

  return (
    <div className="railway-drawer-app">
      {/* Header */}
      <header className="railway-header">
        <div className="header-title">
          <h1>Railway Drawer</h1>
          <p>maxGraph Native Editor</p>
        </div>
      </header>

      {/* Menu Bar */}
      <nav className="railway-menu-bar">
        <div className="menu-group">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(menuOpen === 'file' ? null : 'file')}
          >
            File
          </button>
          {menuOpen === 'file' && (
            <div className="dropdown-menu">
              <button onClick={() => handleFileMenu('new')}>New</button>
              <button onClick={() => handleFileMenu('save')}>Save</button>
              <button onClick={() => handleFileMenu('load')}>Load</button>
            </div>
          )}
        </div>

        <div className="menu-group">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(menuOpen === 'edit' ? null : 'edit')}
          >
            Edit
          </button>
          {menuOpen === 'edit' && (
            <div className="dropdown-menu">
              <button onClick={() => handleEditMenu('undo')}>
                Undo {state.undoCount > 0 && `(${state.undoCount})`}
              </button>
              <button onClick={() => handleEditMenu('redo')}>
                Redo {state.redoCount > 0 && `(${state.redoCount})`}
              </button>
              <div style={{ borderTop: '1px solid #ddd', margin: '4px 0' }} />
              <button onClick={() => handleEditMenu('cut')}>Cut</button>
              <button onClick={() => handleEditMenu('copy')}>Copy</button>
              <button onClick={() => handleEditMenu('paste')}>Paste</button>
              <div style={{ borderTop: '1px solid #ddd', margin: '4px 0' }} />
              <button onClick={() => handleEditMenu('selectAll')}>Select All</button>
            </div>
          )}
        </div>
      </nav>

      {/* Toolbar */}
      <div className="railway-toolbar-wrapper">
        <div
          className="railway-toolbar"
          ref={toolbarContainerRef}
          id="railway-toolbar"
        />
      </div>

      {/* Main Content Area */}
      <div className="railway-workspace" ref={containerRef}>
        {/* Palette/Toolbox */}
        <aside className="railway-palette" ref={paletteRef} />

        {/* Canvas */}
        <div className="railway-canvas-wrapper">
          <div
            ref={canvasRef}
            className="railway-graph-container"
            id="railway-graph-container"
          />
        </div>

        {/* Properties Panel */}
        <aside className="railway-properties">
          <h4>Properties</h4>

          {selectedCell ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Label */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '4px' }}>
                  Label
                </label>
                <input
                  type="text"
                  value={selectedProps.label || ''}
                  onChange={(e) => {
                    if (selectedCell) {
                      selectedCell.value = e.target.value;
                      editorRef.current?.graph?.refresh();
                      setSelectedProps((s) => ({ ...s, label: e.target.value }));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '11px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Width */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '4px' }}>
                  Width: {selectedProps.width?.toFixed(0)}
                </label>
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={selectedProps.width || 100}
                  onChange={(e) => {
                    if (selectedCell?.geometry) {
                      selectedCell.geometry.width = parseFloat(e.target.value);
                      editorRef.current?.graph?.refresh();
                      setSelectedProps((s) => ({ ...s, width: parseFloat(e.target.value) }));
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Height */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '4px' }}>
                  Height: {selectedProps.height?.toFixed(0)}
                </label>
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={selectedProps.height || 60}
                  onChange={(e) => {
                    if (selectedCell?.geometry) {
                      selectedCell.geometry.height = parseFloat(e.target.value);
                      editorRef.current?.graph?.refresh();
                      setSelectedProps((s) => ({ ...s, height: parseFloat(e.target.value) }));
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Fill Color */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '4px' }}>
                  Fill Color
                </label>
                <input
                  type="color"
                  value={selectedProps.fillColor || '#ffffff'}
                  onChange={(e) => {
                    if (selectedCell) {
                      const style = selectedCell.style || '';
                      selectedCell.style = style.replace(/fillColor=[^;]*/g, '') + (style.includes('fillColor') ? '' : ';') + `fillColor=${e.target.value}`;
                      editorRef.current?.graph?.refresh();
                      setSelectedProps((s) => ({ ...s, fillColor: e.target.value }));
                    }
                  }}
                  style={{ width: '100%', height: '32px', cursor: 'pointer', borderRadius: '3px', border: '1px solid #ddd' }}
                />
              </div>

              {/* Stroke Color */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '4px' }}>
                  Border Color
                </label>
                <input
                  type="color"
                  value={selectedProps.strokeColor || '#000000'}
                  onChange={(e) => {
                    if (selectedCell) {
                      const style = selectedCell.style || '';
                      selectedCell.style = style.replace(/strokeColor=[^;]*/g, '') + (style.includes('strokeColor') ? '' : ';') + `strokeColor=${e.target.value}`;
                      editorRef.current?.graph?.refresh();
                      setSelectedProps((s) => ({ ...s, strokeColor: e.target.value }));
                    }
                  }}
                  style={{ width: '100%', height: '32px', cursor: 'pointer', borderRadius: '3px', border: '1px solid #ddd' }}
                />
              </div>

              {/* Delete Button */}
              <button
                onClick={() => {
                  if (selectedCell) {
                    editorRef.current?.graph?.removeCells([selectedCell]);
                    setSelectedCell(null);
                    setSelectedProps({});
                  }
                }}
                style={{
                  padding: '8px 12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginTop: '8px',
                }}
              >
                Delete Shape
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: '#999' }}>Click a shape to edit properties</p>
              <hr style={{ margin: '12px 0', borderColor: '#eee' }} />
              <h4 style={{ marginTop: '16px' }}>Canvas Settings</h4>
              <p style={{ fontSize: '11px', color: '#666' }}>
                Grid: Off<br />
                Snap: Off<br />
                Zoom: {state.zoom}%
              </p>
            </>
          )}
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="railway-statusbar">
        <span>Cells: 0</span>
        <span className="separator">|</span>
        <span>Selected: {state.selectedCells}</span>
        <span className="separator">|</span>
        <span>Zoom: {state.zoom}%</span>
      </footer>
    </div>
  );
};

RailwayDrawerMaxGraphApp.displayName = 'RailwayDrawerMaxGraphApp';
