/**
 * @file RailwayDrawerApp.tsx
 * @brief Main application component for the Railway Drawer application.
 * 
 * This file contains the root component that orchestrates the entire Railway Drawer application,
 * including toolbox, drawing area, properties panel, tab management, and file operations.
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 1.0
 */

import React, { useState, useRef, useEffect } from "react";
import toolboxConfig from "./assets/toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import type { ToolboxItem } from "./components/Toolbox";
import PropertiesPanel from "./components/PropertiesPanel";
import DrawArea, { type DrawAreaRef } from "./components/DrawArea";
import TabPanel, { type DrawAreaTab } from "./components/TabPanel";
import type { DrawElement } from "./components/Elements";
import "./styles/tabpanel.css";

/** @brief Grid size for snap-to-grid functionality */
const GRID_SIZE = 40;

/**
 * Main application component for the Railway Drawer.
 * Handles toolbox, drawing area, properties panel, file operations, and layout.
 * 
 * @component
 * @returns {JSX.Element} The rendered RailwayDrawerApp component.
 */
const RailwayDrawerApp = () => {
  // Toolbox state
  const [toolbox, setToolbox] = useState<ToolboxItem[]>(toolboxConfig as ToolboxItem[]);

  // Ref for the DrawArea component instances (one per tab)
  const drawAreaRefs = useRef<Map<string, DrawAreaRef>>(new Map());

  /** @brief Get the current active DrawArea ref */
  const getCurrentDrawAreaRef = () => drawAreaRefs.current.get(activeTabId);

  /** @brief Get the current active DrawArea ref as a RefObject for components that expect it */
  const getCurrentDrawAreaRefObject = (): React.RefObject<DrawAreaRef | null> => ({
    current: getCurrentDrawAreaRef() || null
  });

  /** @brief Set a DrawArea ref for a specific tab */
  const setDrawAreaRef = (tabId: string, ref: DrawAreaRef | null) => {
    if (ref) {
      drawAreaRefs.current.set(tabId, ref);
    } else {
      drawAreaRefs.current.delete(tabId);
    }
  };

  // Missing refs - add these
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolboxInputRef = useRef<HTMLInputElement>(null);

  // Selected element state
  const [selectedElement, setSelectedElement] = useState<DrawElement | undefined>(undefined);

  // Tab management state
  const [tabs, setTabs] = useState<DrawAreaTab[]>([
    {
      id: 'tab-1',
      name: 'Drawing 1',
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
      selectedElementIds: [] // Add this line
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Export format state
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg" | "pdf">("png");

  /** @brief Panel widths and layout dimensions */
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8
  const [propertiesWidth, setPropertiesWidth] = useState(220);
  const tabPanelHeight= 40;

  /** @brief UI state for editor modal and drawing area */
  const [showEditor, setShowEditor] = useState(false);
  const [drawAreaSize, setDrawAreaSize] = useState({ width: 2000, height: 1500 });
  const [zoom, setZoom] = useState(1);

  /** @brief Global clipboard state shared between all tabs */
  const [globalCopiedElements, setGlobalCopiedElements] = useState<DrawElement[]>([]);

  /** @brief Get current active tab from tabs array */
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  /**
   * @brief Creates a new drawing tab with default settings
   * @details Generates a unique tab ID based on timestamp and initializes with empty elements
   */
  const handleTabCreate = () => {
    // Save current tab state before creating and switching to new tab
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (currentDrawAreaRef && activeTab) {
      const currentElements = currentDrawAreaRef.getElements();
      const currentGridVisible = currentDrawAreaRef.getGridVisible();
      const currentBgColor = currentDrawAreaRef.getSvgElement()?.style.backgroundColor || '#ffffff';
      const currentSelectedIds = currentDrawAreaRef.getSelectedElementIds();
      
      // Sync global clipboard before switching tabs
      const currentCopiedElements = currentDrawAreaRef.getCopiedElements();
      if (currentCopiedElements.length > 0) {
        setGlobalCopiedElements(currentCopiedElements);
        console.log(`Tab create: Synced ${currentCopiedElements.length} elements to global clipboard`);
      }

      // Update current tab with latest state
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              elements: currentElements.map((element: DrawElement) => ({
                ...element,
                // Ensure all element properties are preserved
                start: { ...element.start },
                end: { ...element.end },
                gridEnabled: currentGridVisible,
                backgroundColor: currentBgColor,
                setGridEnabled: currentDrawAreaRef?.setGridVisible || (() => {}),
                setBackgroundColor: () => {}
              })),
              gridVisible: currentGridVisible,
              backgroundColor: currentBgColor,
              selectedElementIds: currentSelectedIds
            }
          : tab
      ));
    }

    const newTabId = `tab-${Date.now()}`;
    const newTab: DrawAreaTab = {
      id: newTabId,
      name: `Drawing ${tabs.length + 1}`,
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
      selectedElementIds: [] // Initialize with empty selection
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    setSelectedElement(undefined);
  };

  /**
   * @brief Closes a tab and handles cleanup
   * @param tabId The ID of the tab to close
   * @details Prevents closing the last tab and switches to first tab if active tab is closed
   */
  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return; // Prevent closing last tab
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    // Switch to first tab if the active tab was closed
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
    setSelectedElement(undefined);
  };  /**
   * @brief Handles switching between tabs and preserves current tab state
   * @param tabId The ID of the tab to switch to
   * @details Saves current elements, grid visibility, and background color before switching
   */
  const handleTabChange = (tabId: string) => {
    // Save current tab state before switching
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (currentDrawAreaRef && activeTab) {
      const currentElements = currentDrawAreaRef.getElements();
      const currentGridVisible = currentDrawAreaRef.getGridVisible();
      const currentBgColor = currentDrawAreaRef.getSvgElement()?.style.backgroundColor || '#ffffff';
      
      // Sync global clipboard before switching tabs
      const currentCopiedElements = currentDrawAreaRef.getCopiedElements();
      if (currentCopiedElements.length > 0) {
        setGlobalCopiedElements(currentCopiedElements);
        console.log(`Tab switch: Synced ${currentCopiedElements.length} elements to global clipboard`);
      }

      const currentSelectedIds = currentDrawAreaRef.getSelectedElementIds();

      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              elements: currentElements.map((element: DrawElement) => ({
                ...element,
                // Ensure all element properties are preserved
                start: { ...element.start },
                end: { ...element.end },
                gridEnabled: currentGridVisible,
                backgroundColor: currentBgColor,
                setGridEnabled: currentDrawAreaRef?.setGridVisible || (() => {}),
                setBackgroundColor: () => {}
              })),
              gridVisible: currentGridVisible,
              backgroundColor: currentBgColor,
              selectedElementIds: currentSelectedIds
            }
          : tab
      ));
    }

    setActiveTabId(tabId);
    setSelectedElement(undefined);
  };

  /**
   * @brief Renames a tab
   * @param tabId The ID of the tab to rename
   * @param newName The new name for the tab
   */
  const handleTabRename = (tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
  };

  /**
   * @brief Effect to update DrawArea when active tab changes
   * @details Synchronizes DrawArea content with the active tab's elements, grid, and background
   */
  useEffect(() => {
    // Small delay to ensure DrawArea component is mounted
    const timer = setTimeout(() => {
      const currentDrawAreaRef = getCurrentDrawAreaRef();
      if (currentDrawAreaRef && activeTab) {
        console.log(`Switching to tab ${activeTab.id}: ${activeTab.elements.length} elements`);
        
        // Set elements first
        currentDrawAreaRef.setElements(activeTab.elements);
        currentDrawAreaRef.setGridVisible(activeTab.gridVisible);
        
        // Sync global clipboard with DrawArea
        if (globalCopiedElements.length > 0) {
          currentDrawAreaRef.setCopiedElements(globalCopiedElements);
          console.log(`Tab load: Synced ${globalCopiedElements.length} elements from global clipboard`);
        }
        
        const svgElement = currentDrawAreaRef.getSvgElement();
        if (svgElement) {
          svgElement.style.backgroundColor = activeTab.backgroundColor;
        }
      } else {
        console.warn(`DrawArea ref not found for tab ${activeTabId}`);
      }
    }, 50); // Small delay to ensure component is mounted

    return () => clearTimeout(timer);
  }, [activeTabId, activeTab]); // Removed globalCopiedElements from dependencies

  /**
   * @brief Effect to sync global clipboard with the current DrawArea
   * @details Updates the DrawArea's local clipboard when global clipboard changes
   */
  useEffect(() => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (currentDrawAreaRef && globalCopiedElements.length > 0) {
      currentDrawAreaRef.setCopiedElements(globalCopiedElements);
      console.log(`Clipboard sync: Updated DrawArea clipboard with ${globalCopiedElements.length} elements`);
    }
  }, [globalCopiedElements, activeTabId]);

  /**
   * @brief Dummy setter for dragged item (required by Toolbox component)
   * @details This is a placeholder function to satisfy the Toolbox interface
   */
  const setDraggedItem = () => {};

  /**
   * @brief Handle global copy/paste operations that work across tabs
   * @details Maintains clipboard state at app level for cross-tab functionality
   */
  const handleGlobalCopy = () => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (currentDrawAreaRef) {
      try {
        const copiedElements = currentDrawAreaRef.copySelectedElements();
        
        // If the copy function returned elements, use them immediately
        if (copiedElements && copiedElements.length > 0) {
          setGlobalCopiedElements(copiedElements);
          console.log(`Global copy: ${copiedElements.length} elements copied to global clipboard`);
        } else {
          // Fallback to the async approach with timeout
          setTimeout(() => {
            const fallbackCopiedElements = currentDrawAreaRef.getCopiedElements();
            if (fallbackCopiedElements.length > 0) {
              setGlobalCopiedElements(fallbackCopiedElements);
              console.log(`Global copy (fallback): ${fallbackCopiedElements.length} elements copied to global clipboard`);
            } else {
              console.warn('Global copy: No elements selected for copying');
            }
          }, 10);
        }
      } catch (error) {
        console.error('Error during global copy:', error);
      }
    } else {
      console.warn('Global copy: No active DrawArea ref found');
    }
  };

  const handleGlobalPaste = () => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    
    // First check if we have elements in the global clipboard
    if (globalCopiedElements.length > 0) {
      if (currentDrawAreaRef) {
        try {
          // Ensure DrawArea has the latest global clipboard
          currentDrawAreaRef.setCopiedElements(globalCopiedElements);
          currentDrawAreaRef.pasteElements();
          console.log(`Global paste: ${globalCopiedElements.length} elements pasted from global clipboard`);
        } catch (error) {
          console.error('Error during global paste:', error);
        }
      } else {
        console.warn('Global paste: No active DrawArea ref found');
      }
    } else {
      // Fallback: try to get elements from current DrawArea's local clipboard
      if (currentDrawAreaRef) {
        const localCopiedElements = currentDrawAreaRef.getCopiedElements();
        if (localCopiedElements.length > 0) {
          try {
            currentDrawAreaRef.pasteElements();
            console.log(`Local paste: ${localCopiedElements.length} elements pasted from local clipboard`);
          } catch (error) {
            console.error('Error during local paste:', error);
          }
        } else {
          console.warn('Global paste: No elements in clipboard (both global and local are empty)');
        }
      } else {
        console.warn('Global paste: No active DrawArea ref found');
      }
    }
  };

  const handleGlobalCut = () => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (currentDrawAreaRef) {
      try {
        const cutElements = currentDrawAreaRef.cutSelectedElements();
        
        // If the cut function returned elements, use them immediately
        if (cutElements && cutElements.length > 0) {
          setGlobalCopiedElements(cutElements);
          console.log(`Global cut: ${cutElements.length} elements cut to global clipboard`);
        } else {
          // Fallback to the async approach with timeout
          setTimeout(() => {
            const fallbackCopiedElements = currentDrawAreaRef.getCopiedElements();
            if (fallbackCopiedElements.length > 0) {
              setGlobalCopiedElements(fallbackCopiedElements);
              console.log(`Global cut (fallback): ${fallbackCopiedElements.length} elements cut to global clipboard`);
            } else {
              console.warn('Global cut: No elements selected for cutting');
            }
          }, 10);
        }
      } catch (error) {
        console.error('Error during global cut:', error);
      }
    } else {
      console.warn('Global cut: No active DrawArea ref found');
    }
  };

  /**
   * @brief Effect to handle global keyboard shortcuts for copy/paste
   * @details Provides copy/paste functionality that works across tabs
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Global Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleGlobalCopy();
      }
      
      // Global Cut (Ctrl+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleGlobalCut();
      }
      
      // Global Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handleGlobalPaste();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [globalCopiedElements, activeTabId]); // Add activeTabId to dependencies

  /**
   * @brief Saves current drawing elements as a JSON file
   * @details Exports all elements from the current tab to a downloadable JSON file
   */
  const saveAsJson = () => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    const elements = currentDrawAreaRef?.getElements?.();
    if (!elements) return;
    const data = JSON.stringify({ elements }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "railway_drawing.json";
    link.click();
  };

  /**
   * @brief Loads drawing elements from a JSON file
   * @param e The file input change event
   * @details Parses JSON file and loads elements into the current drawing area
   */
  const loadFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            const currentDrawAreaRef = getCurrentDrawAreaRef();
            if (currentDrawAreaRef) {
              currentDrawAreaRef.setElements(parsed.elements || []);
            }
          } catch (err) {
            // On parse error, clear elements
            const currentDrawAreaRef = getCurrentDrawAreaRef();
            if (currentDrawAreaRef) {
              currentDrawAreaRef.setElements([]);
            }
          }
        }
      };
      reader.readAsText(file);
    }
  };

  /**
   * @brief Exports the drawing as an image file
   * @details Supports PNG, JPG, SVG, and PDF formats using html-to-image and jsPDF libraries
   */
  const exportToImage = () => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    const node = currentDrawAreaRef?.getSvgElement?.();
    if (!node) return;
    
    // Handle SVG export directly
    if (exportFormat === "svg") {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(node);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "railway_drawing.svg";
      link.click();
      return;
    }
    
    // Handle PDF export
    if (exportFormat === "pdf") {
      import("jspdf").then(jsPDF => {
        import("html-to-image").then(htmlToImage => {
          htmlToImage.toSvg(node as unknown as HTMLElement).then((dataUrl: string) => {
            const pdf = new jsPDF.jsPDF({
              orientation: "landscape",
              unit: "px",
              format: [node.width.baseVal.value, node.height.baseVal.value],
            });
            pdf.addImage(
              dataUrl,
              "PNG",
              0,
              0,
              node.width.baseVal.value,
              node.height.baseVal.value
            );
            pdf.save("railway_drawing.pdf");
          });
        });
      });
      return;
    }
    
    // Handle PNG/JPG export
    import("html-to-image").then(htmlToImage => {
      const fn = exportFormat === "jpg" ? htmlToImage.toJpeg : htmlToImage.toSvg;
      fn(node as unknown as HTMLElement).then((dataUrl: string) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `railway_drawing.${exportFormat}`;
        link.click();
      });
    });
  };

  /**
   * @brief Saves current toolbox configuration as JSON
   * @details Exports all toolbox items to a downloadable JSON configuration file
   */
  const saveToolboxAsJson = () => {
    const data = JSON.stringify(
      toolbox.map(({ ...rest }) => ({ ...rest })),
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "toolbox_config.json";
    link.click();
  };

  /**
   * @brief Loads toolbox configuration from JSON file
   * @param e The file input change event
   * @details Parses JSON and updates toolbox items with proper icon handling
   */
  const loadToolboxFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            setToolbox(
              parsed.map((item: any) => ({
                ...item,
                iconSvg: item.iconSource === "custom" ? item.iconSvg || item.shape : undefined,
                iconName: item.iconName,
              }))
            );
          } catch (err) {
            // Silently ignore parse errors
          }
        }
      };
      reader.readAsText(file);
    }
  };

  /**
   * @brief Handles toolbox panel resizing via mouse drag
   * @param e The mouse event that started the resize
   * @details Sets up mouse move/up listeners to track resize and update panel width
   */
  const startResizeToolbox = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = toolboxWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setToolboxWidth(Math.max(120, startWidth + (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /**
   * @brief Handles properties panel resizing via mouse drag
   * @param e The mouse event that started the resize
   * @details Sets up mouse move/up listeners to track resize and update panel width
   */
  const startResizeProperties = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = propertiesWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setPropertiesWidth(Math.max(180, startWidth - (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /** @brief Ref for the draw area container DOM element */
  const drawAreaPanelRef = useRef<HTMLDivElement>(null);

  /**
   * @brief Effect to observe draw area container resize and update dimensions
   * @details Uses ResizeObserver to track container size changes and update drawAreaSize state
   */
  useEffect(() => {
    const node = drawAreaPanelRef.current; // This is the DOM element
    if (!node) return;
    const observer = new window.ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDrawAreaSize({ width, height });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * @brief Increases zoom level by 20% up to maximum of 500%
   */
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  
  /**
   * @brief Decreases zoom level by 20% down to minimum of 20%
   */
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));
  
  /**
   * @brief Resets zoom level to 100%
   */
  const handleZoomReset = () => setZoom(1);

  return (
    <div className="flex flex-col h-screen w-screen">
      {/* --- Standard Menu Bar --- */}
      <div className="menu-bar" style={{ position: "relative", zIndex: 100 }}>
        <div className="menu-dropdown">
          <button className="custom-btn" style={{ borderRadius: 0, borderRight: "1px solid #e0e0e0" }}>
            File
          </button>
          <div className="menu-dropdown-content">
            <div onClick={() => fileInputRef.current?.click()}>Open...</div>
            <div onClick={saveAsJson}>Save</div>
            <div>
              Export As
              <div className="menu-sub-dropdown">
                <div onClick={() => { setExportFormat("png"); exportToImage(); }}>PNG</div>
                <div onClick={() => { setExportFormat("jpg"); exportToImage(); }}>JPG</div>
                <div onClick={() => { setExportFormat("svg"); exportToImage(); }}>SVG</div>
                <div onClick={() => { setExportFormat("pdf"); exportToImage(); }}>PDF</div>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={loadFromJson}
          />
        </div>
        <div className="menu-dropdown">
          <button className="custom-btn" style={{ borderRadius: 0, borderRight: "1px solid #e0e0e0" }}>
            Toolbox
          </button>
          <div className="menu-dropdown-content">
            <div onClick={saveToolboxAsJson}>Save Toolbox</div>
            <div onClick={() => toolboxInputRef.current?.click()}>Open Toolbox Config</div>
            <div onClick={() => setShowEditor(true)}>Add new shape</div>
          </div>
          <input
            ref={toolboxInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={loadToolboxFromJson}
          />
        </div>
      </div>
      {/* Main Layout */}
      <div className="layout-main" style={{ height: `calc(100vh - ${tabPanelHeight}px)` }}>
        <div
          className="toolbox-panel"
          style={{ width: toolboxWidth, minWidth: 120 }}
        >
          <Toolbox
            toolbox={toolbox}
            setToolbox={setToolbox}
            showEditor={showEditor}
            setShowEditor={setShowEditor}
            setDraggedItem={setDraggedItem}
          />
        </div>
        
        <div
          style={{
            width: 6,
            cursor: "ew-resize",
            background: "#e0e0e0",
            zIndex: 10,
          }}
          onMouseDown={startResizeToolbox}
        />
        
        <div
          ref={drawAreaPanelRef} // Add this ref to the container
          className="draw-area-panel"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: 8 }}>
            <button onClick={handleZoomOut}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn}>+</button>
            <button onClick={handleZoomReset}>Reset</button>
          </div>
          {/* Render DrawArea for each tab, toggling visibility based on activeTabId */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              <DrawArea
                ref={(ref) => setDrawAreaRef(tab.id, ref)}
                GRID_WIDTH={drawAreaSize.width}
                GRID_HEIGHT={drawAreaSize.height}
                GRID_SIZE={GRID_SIZE}
                zoom={zoom}
                setSelectedElement={setSelectedElement}
                disableKeyboardHandlers={true}
              />
            </div>
          ))}
        </div>
        
        <div
          style={{
            width: 6,
            cursor: "ew-resize",
            background: "#e0e0e0",
            zIndex: 10,
          }}
          onMouseDown={startResizeProperties}
        />
        
        <div
          className="properties-panel"
          style={{ width: propertiesWidth, minWidth: 180 }}
        >
          <PropertiesPanel
            drawAreaRef={getCurrentDrawAreaRefObject()}
            selectedElement={selectedElement}
            onElementChange={setSelectedElement}
          />
        </div>
      </div>

      {/* Bottom Tab Panel */}
      <div style={{ height: tabPanelHeight }}>
        <TabPanel
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={handleTabChange}
          onTabCreate={handleTabCreate}
          onTabClose={handleTabClose}
          onTabRename={handleTabRename}
        />
      </div>
    </div>
  );
};

export default RailwayDrawerApp;

