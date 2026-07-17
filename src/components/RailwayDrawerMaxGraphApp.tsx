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

import React, { useRef, useEffect, useState } from 'react';
import { Editor } from '@maxgraph/core';
import './styles/railwayDrawerMaxGraphApp.css';

interface RailwayDrawerAppState {
  dirty: boolean;
  selectedCells: number;
  cellCount: number;
  zoom: number;
  undoCount: number;
  redoCount: number;
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
        console.log('📥 Creating maxGraph Editor');
        const editor = new Editor();
        editorRef.current = editor;

        const graphContainer = canvasRef.current;
        if (graphContainer) {
          graphContainer.style.width = '100%';
          graphContainer.style.height = '100%';
          graphContainer.style.position = 'relative';
          graphContainer.style.overflow = 'hidden';
        }

        editor.setGraphContainer(graphContainer);
        console.log('✅ Editor initialized');

        // Setup toolbar
        setupToolbar(editor);

        // Setup palette with embedded shapes
        setupPalette(editor);

        // Setup canvas drop zone
        if (graphContainer) {
          setupCanvasDropZone(editor, graphContainer);
        }

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

      console.log('📦 Creating palette with embedded shapes');
      palette.innerHTML = '';

      const header = document.createElement('div');
      header.style.cssText = 'padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd; color: #333; font-size: 13px; position: sticky; top: 0; background: white; z-index: 10;';
      header.textContent = 'Shapes';
      palette.appendChild(header);

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

      shapes.forEach((shape, index) => {
        // Add group header
        if (currentGroup !== shape.group) {
          currentGroup = shape.group;
          const groupDiv = document.createElement('div');
          groupDiv.style.cssText = 'padding: 10px 12px 6px 12px; font-size: 11px; font-weight: 600; color: #666; border-top: 1px solid #eee; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
          groupDiv.textContent = shape.group;
          palette.appendChild(groupDiv);
        }

        // Add draggable shape item
        const shapeItem = document.createElement('div');
        shapeItem.draggable = true;
        shapeItem.style.cssText = `
          padding: 10px 12px;
          margin: 3px 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: move;
          font-size: 12px;
          text-align: center;
          transition: all 0.2s;
          user-select: none;
          color: #333;
        `;
        shapeItem.textContent = shape.name;
        shapeItem.id = `shape-${index}`;

        // Drag event handlers
        shapeItem.addEventListener('dragstart', (e) => {
          const dragData = {
            name: shape.name,
            style: shape.style,
            width: shape.width,
            height: shape.height,
          };
          e.dataTransfer!.effectAllowed = 'copy';
          e.dataTransfer!.setData('application/json', JSON.stringify(dragData));
          shapeItem.style.opacity = '0.6';
        });

        shapeItem.addEventListener('dragend', () => {
          shapeItem.style.opacity = '1';
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

        palette.appendChild(shapeItem);
      });

      // Setup drop handlers on canvas
      setupCanvasDropZone(editor, canvasRef.current!);
    } catch (error) {
      console.error('Palette setup failed:', error);
    }
  };

  const setupCanvasDropZone = (editor: Editor, canvasElement: HTMLElement) => {
    try {
      canvasElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
        canvasElement.style.background = 'rgba(25, 118, 210, 0.05)';
      });

      canvasElement.addEventListener('dragleave', () => {
        canvasElement.style.background = '#ffffff';
      });

      canvasElement.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasElement.style.background = '#ffffff';

        try {
          const json = e.dataTransfer!.getData('application/json');
          if (!json) return;

          const shapeData = JSON.parse(json);
          if (!editor.graph) {
            console.error('Graph not available');
            return;
          }

          const graph = editor.graph;
          const rect = canvasElement.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const parent = graph.getDefaultParent();
          graph.batchUpdate(() => {
            const cell = graph.insertVertex(
              parent,
              null,
              shapeData.name,
              x - shapeData.width / 2,
              y - shapeData.height / 2,
              shapeData.width,
              shapeData.height,
              shapeData.style
            );
            graph.setSelectionCells([cell]);
          });
        } catch (error) {
          console.error('Drop failed:', error);
        }
      });
    } catch (error) {
      console.error('Canvas drop zone setup failed:', error);
    }
  };


  const handleFileMenu = (action: string) => {
    if (!editorRef.current) return;

    switch (action) {
      case 'new':
        editorRef.current.execute('new');
        setState((s) => ({ ...s, dirty: false }));
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
    if (!editorRef.current) return;

    switch (action) {
      case 'undo':
        editorRef.current.execute('undo');
        break;
      case 'redo':
        editorRef.current.execute('redo');
        break;
      case 'cut':
        editorRef.current.execute('cut');
        break;
      case 'copy':
        editorRef.current.execute('copy');
        break;
      case 'paste':
        editorRef.current.execute('paste');
        break;
      case 'selectAll':
        editorRef.current.execute('selectAll');
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

        {/* Properties Panel Placeholder */}
        <aside className="railway-properties">
          <h4>Properties</h4>
          <p>Selected: {state.selectedCells} cell(s)</p>
          <p>Zoom: {state.zoom}%</p>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="railway-statusbar" />
    </div>
  );
};

RailwayDrawerMaxGraphApp.displayName = 'RailwayDrawerMaxGraphApp';
