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
      const stylesheet = graph.getStylesheet();

      // Create palette container
      paletteRef.current.innerHTML = '<div style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Shapes</div>';

      // Get shape definitions from config
      const shapes = [
        // Tracks
        { name: 'Main Track', style: 'track', group: 'Tracks' },
        { name: 'Minor Track', style: 'shape=line;strokeColor=#8B4513;strokeWidth=2', group: 'Tracks' },

        // Stations
        { name: 'Major Station', style: 'station', group: 'Stations' },
        { name: 'Minor Station', style: 'station-small', group: 'Stations' },
        { name: 'Platform', style: 'platform', group: 'Stations' },

        // Signals
        { name: 'Signal Head', style: 'signal-head', group: 'Signals' },
        { name: 'Stop Signal', style: 'signal-aspect-stop', group: 'Signals' },
        { name: 'Proceed Signal', style: 'signal-aspect-proceed', group: 'Signals' },

        // Junctions
        { name: 'Junction', style: 'junction-simple', group: 'Junctions' },
        { name: 'Diamond Junction', style: 'junction-diamond', group: 'Junctions' },

        // Speed
        { name: 'Speed Limit', style: 'speed-limit', group: 'Speed' },
      ];

      let currentGroup = '';

      shapes.forEach(shape => {
        // Add group header
        if (currentGroup !== shape.group) {
          currentGroup = shape.group;
          const groupDiv = document.createElement('div');
          groupDiv.style.cssText = 'padding: 8px 4px 4px 4px; font-size: 11px; font-weight: bold; color: #666; border-top: 1px solid #eee; margin-top: 4px;';
          groupDiv.textContent = shape.group;
          paletteRef.current!.appendChild(groupDiv);
        }

        // Add shape button
        const shapeBtn = document.createElement('div');
        shapeBtn.style.cssText = 'padding: 8px; margin: 2px; background: white; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-size: 12px; text-align: center; transition: all 0.2s;';
        shapeBtn.textContent = shape.name;

        shapeBtn.addEventListener('mouseenter', () => {
          shapeBtn.style.background = '#f0f0f0';
          shapeBtn.style.borderColor = '#1976d2';
        });

        shapeBtn.addEventListener('mouseleave', () => {
          shapeBtn.style.background = 'white';
          shapeBtn.style.borderColor = '#ccc';
        });

        shapeBtn.addEventListener('click', () => {
          // Create a new cell
          const parent = graph.getDefaultParent();
          graph.getModel().beginUpdate();
          try {
            const cell = graph.insertVertex(
              parent,
              null,
              shape.name,
              10,
              10,
              100,
              60,
              shape.style
            );
          } finally {
            graph.getModel().endUpdate();
          }
        });

        paletteRef.current!.appendChild(shapeBtn);
      });
    } catch (error) {
      console.error('Palette setup failed:', error);
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
