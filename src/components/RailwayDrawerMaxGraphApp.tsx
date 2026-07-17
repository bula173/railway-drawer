/**
 * @file RailwayDrawerMaxGraphApp.tsx
 * @brief Railway Drawer built ONLY on maxGraph native components
 *
 * Architecture:
 * - Editor class (orchestration)
 * - XML configuration (all features)
 * - EditorToolbar (auto-generated from config)
 * - Palette (shape toolbox, auto-loaded from config)
 * - Outline View (minimap)
 * - Undo/Redo (automatic via UndoManager)
 * - Keyboard Shortcuts (auto-wired via KeyHandler)
 *
 * Everything is maxGraph native!
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Editor, EditorToolbar, Outline } from '@maxgraph/core';
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
    if (!containerRef.current || !toolbarContainerRef.current || !canvasRef.current) return;

    const initializeEditor = async () => {
      try {
        // Load Railway Drawer configuration
        const response = await fetch('/config/railwayDrawerConfig.xml');
        const configText = await response.text();
        const parser = new DOMParser();
        const configXml = parser.parseFromString(configText, 'text/xml').documentElement;

        // Create Editor with configuration
        const editor = new Editor(configXml);
        editorRef.current = editor;

        // Set graph container (main drawing area)
        const graphContainer = canvasRef.current;
        graphContainer.style.width = '100%';
        graphContainer.style.height = '100%';
        editor.setGraphContainer(graphContainer);
        const graph = editor.graph;

        // Setup toolbar (auto-generated from config)
        setupToolbar(editor);

        // Setup palette/toolbox (shape library)
        setupPalette(editor);

        // Setup outline view (minimap)
        setupOutlineView(editor);

        // Setup status bar with live updates
        setupStatusBar(editor);

        // Setup menu functionality
        setupMenus(editor);

        // Setup event listeners
        if (graph) {
          // Model change listener
          graph.getModel().addListener('change', () => {
            setState((s) => ({ ...s, dirty: true }));
          });

          // Selection change listener
          graph.getSelectionModel().addListener('change', () => {
            const selected = graph.getSelectionModel().getCells().length;
            setState((s) => ({ ...s, selectedCells: selected }));
          });

          // Zoom listener
          graph.getView().addListener('scale', () => {
            const zoom = Math.round(graph.getView().getScale() * 100);
            setState((s) => ({ ...s, zoom }));
          });

          // Undo/Redo listener
          if (editor.undoManager) {
            editor.undoManager.addListener('change', () => {
              setState((s) => ({
                ...s,
                undoCount: editor.undoManager?.undoStack?.length || 0,
                redoCount: editor.undoManager?.redoStack?.length || 0,
              }));
            });
          }

          // Count cells on load
          const cellCount = graph.getModel().getChildCount(graph.getDefaultParent());
          setState((s) => ({ ...s, cellCount }));
        }
      } catch (error) {
        console.error('Failed to initialize editor:', error);
      }
    };

    initializeEditor();

    return () => {
      editorRef.current?.destroy?.();
    };
  }, []);

  const setupToolbar = (editor: Editor) => {
    try {
      if (!toolbarContainerRef.current) return;

      const toolbar = new EditorToolbar(editor, toolbarContainerRef.current);
      toolbar.render(toolbarContainerRef.current);
    } catch (error) {
      console.error('Toolbar setup failed:', error);
    }
  };

  const setupPalette = (editor: Editor) => {
    try {
      if (!paletteRef.current || !editor.graph) return;

      const graph = editor.graph;

      // Create palette container
      paletteRef.current.innerHTML = '<div style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd; color: #333; font-size: 13px;">Shapes</div>';

      // Get shape definitions from config
      const shapes = [
        // Tracks
        { name: 'Main Track', style: 'track', group: 'Tracks', width: 150, height: 8 },
        { name: 'Minor Track', style: 'shape=line;strokeColor=#8B4513;strokeWidth=2', group: 'Tracks', width: 120, height: 8 },

        // Stations
        { name: 'Major Station', style: 'station', group: 'Stations', width: 100, height: 60 },
        { name: 'Minor Station', style: 'station-small', group: 'Stations', width: 80, height: 50 },
        { name: 'Platform', style: 'platform', group: 'Stations', width: 120, height: 40 },

        // Signals
        { name: 'Signal Head', style: 'signal-head', group: 'Signals', width: 50, height: 80 },
        { name: 'Stop Signal', style: 'signal-aspect-stop', group: 'Signals', width: 40, height: 40 },
        { name: 'Proceed Signal', style: 'signal-aspect-proceed', group: 'Signals', width: 40, height: 40 },

        // Junctions
        { name: 'Junction', style: 'junction-simple', group: 'Junctions', width: 80, height: 60 },
        { name: 'Diamond', style: 'junction-diamond', group: 'Junctions', width: 80, height: 80 },

        // Speed
        { name: 'Speed Limit', style: 'speed-limit', group: 'Speed', width: 90, height: 50 },
      ];

      let currentGroup = '';

      shapes.forEach((shape, index) => {
        // Add group header
        if (currentGroup !== shape.group) {
          currentGroup = shape.group;
          const groupDiv = document.createElement('div');
          groupDiv.style.cssText = 'padding: 10px 12px 6px 12px; font-size: 11px; font-weight: 600; color: #666; border-top: 1px solid #eee; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
          groupDiv.textContent = shape.group;
          paletteRef.current!.appendChild(groupDiv);
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

        paletteRef.current!.appendChild(shapeItem);
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
          const graph = editor.graph;

          // Get drop position relative to canvas
          const rect = canvasElement.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          // Convert to graph coordinates
          const scale = graph.getView().getScale();
          const translate = graph.getView().getTranslate();
          const graphX = x / scale - translate.x;
          const graphY = y / scale - translate.y;

          // Create new vertex at drop position
          const parent = graph.getDefaultParent();
          graph.getModel().beginUpdate();
          try {
            const cell = graph.insertVertex(
              parent,
              null,
              shapeData.name,
              graphX - shapeData.width / 2,
              graphY - shapeData.height / 2,
              shapeData.width,
              shapeData.height,
              shapeData.style
            );
            graph.setSelectionCell(cell);
          } finally {
            graph.getModel().endUpdate();
          }
        } catch (error) {
          console.error('Drop failed:', error);
        }
      });
    } catch (error) {
      console.error('Canvas drop zone setup failed:', error);
    }
  };

  const setupOutlineView = (editor: Editor) => {
    try {
      if (editor.graph) {
        const outlineContainer = document.createElement('div');
        outlineContainer.id = 'railway-outline';
        outlineContainer.className = 'railway-outline';

        if (containerRef.current) {
          containerRef.current.appendChild(outlineContainer);
        }

        new Outline(editor.graph, outlineContainer);
      }
    } catch (error) {
      console.error('Outline setup failed:', error);
    }
  };

  const setupStatusBar = (editor: Editor) => {
    try {
      const statusBar = document.querySelector('.railway-statusbar') as HTMLElement;
      if (!statusBar || !editor.graph) return;

      const updateStatus = () => {
        if (editor.graph) {
          const cells = editor.graph.getModel().getChildCount(editor.graph.getDefaultParent());
          const zoom = Math.round(editor.graph.getView().getScale() * 100);
          const dirty = state.dirty ? '●' : '';
          const undoLabel = state.undoCount > 0 ? `(${state.undoCount})` : '';
          const redoLabel = state.redoCount > 0 ? `(${state.redoCount})` : '';

          statusBar.innerHTML = `
            ${dirty ? '<span class="dirty-indicator">●</span>' : ''}
            <span>Cells: ${cells}</span>
            <span class="separator">|</span>
            <span>Selected: ${state.selectedCells}</span>
            <span class="separator">|</span>
            <span>Zoom: ${zoom}%</span>
            <span class="separator">|</span>
            <span>Undo ${undoLabel}</span>
            <span class="separator">|</span>
            <span>Redo ${redoLabel}</span>
          `;
        }
      };

      editor.graph?.addListener('change', updateStatus);
      editor.graph?.getSelectionModel().addListener('change', updateStatus);
      updateStatus();
    } catch (error) {
      console.error('Status bar setup failed:', error);
    }
  };

  const setupMenus = (editor: Editor) => {
    // Menus are set up via keyboard shortcuts and toolbar
    // Additional menu items can be added here as needed
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

    try {
      const mxCodec = (window as any).mxCodec;
      if (mxCodec) {
        const encoder = new mxCodec();
        const node = encoder.encode(editorRef.current.graph.getModel());
        const mxUtils = (window as any).mxUtils;
        if (mxUtils) {
          const xml = mxUtils.getXml(node);
          localStorage.setItem('railway-diagram', xml);
          setState((s) => ({ ...s, dirty: false }));
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, []);

  const handleLoad = useCallback(() => {
    if (!editorRef.current?.graph) return;

    try {
      const xml = localStorage.getItem('railway-diagram');
      if (xml) {
        // TODO: Implement XML load into graph model
        setState((s) => ({ ...s, dirty: false }));
      }
    } catch (error) {
      console.error('Load failed:', error);
    }
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
      <div className="railway-workspace">
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
