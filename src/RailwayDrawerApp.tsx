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

import React, { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { MousePointer2, Ruler, Train, Edit2, Check, X } from "lucide-react";
import toolboxConfig from "./assets/toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import type { ToolboxItem } from "./components/Toolbox";
import type { DrawAreaTab } from "./components/TabPanel";
import EnhancedPropertiesPanel from "./components/EnhancedPropertiesPanel";
import DrawArea, { type DrawAreaRef } from "./components/DrawArea";
import { LayersPanel } from "./components/LayersPanel";
import { PageManager } from "./components/PageManager";
import { EditMenu } from "./components/EditMenu";
import type { DrawElement } from "./components/Elements";
import type { DrawTool, Layer } from "./types";
import { logger } from "./utils/logger";

/** @brief Grid size for snap-to-grid functionality */
const GRID_SIZE = 40;

/** @brief Timeout for async clipboard operations (ms) */
// Removed - no longer needed with simplified copy/paste implementation

/** @brief Application version */
const APP_VERSION = "0.3.0 Beta";

/** @brief Application author */
const APP_AUTHOR = "Marcin Kwiatkowski";

/**
 * Main application component for the Railway Drawer.
 * Handles toolbox, drawing area, properties panel, file operations, and layout.
 * 
 * @component
 * @returns {JSX.Element} The rendered RailwayDrawerApp component.
 */
const RailwayDrawerApp = () => {
  // Toolbox state
  const [toolbox, setToolbox] = useState<ToolboxItem[]>(() => {
    const config = toolboxConfig as ToolboxItem[];
    logger.debug("RailwayDrawerApp", "Loading toolbox configuration", {
      totalItems: config.length,
      hasPointElement: !!config.find(item => item.id === 'point'),
      hasTrackElement: !!config.find(item => item.id === 'track')
    });
    return config;
  });

  // Ref for the DrawArea component instances (one per tab)
  const drawAreaRefs = useRef<Map<string, DrawAreaRef>>(new Map());
  
  // Create a stable ref object for PropertiesPanel
  const currentDrawAreaRefObject = useRef<DrawAreaRef | null>(null);

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
  const isOpeningFileRef = useRef(false);
  const isOpeningToolboxRef = useRef(false);
  const isSavingRef = useRef(false);

  // Selected element state
  const [selectedElement, setSelectedElement] = useState<DrawElement | undefined>(undefined);

  // Active tool state
  const [activeTool, setActiveTool] = useState<DrawTool>('select');

  // Layers state
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'default', name: 'Background Layer', visible: true, locked: false },
    { id: 'foreground', name: 'Foreground Layer', visible: true, locked: false }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('default');

  /** @brief Toggle layer visibility */
  const handleLayerToggleVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  /** @brief Toggle layer lock */
  const handleLayerToggleLock = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  };

  /** @brief Add a new layer */
  const handleAddLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

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

  /** @brief Global clipboard state shared between all tabs */
  const [globalCopiedElements, setGlobalCopiedElements] = useState<DrawElement[]>([]);

  // Edit menu state
  const [editMenuState, setEditMenuState] = useState({
    canUndo: false,
    canRedo: false,
    hasSelection: false,
    hasCopiedElements: false
  });
  
  /** @brief About dialog state */
  const [showAbout, setShowAbout] = useState(false);

  /** @brief Update edit menu state based on current DrawArea */
  const updateEditMenuState = useCallback(() => {
    const currentRef = currentDrawAreaRefObject.current;
    
    if (currentRef) {
      setEditMenuState({
        canUndo: currentRef.canUndo(),
        canRedo: currentRef.canRedo(),
        hasSelection: currentRef.getSelectedElementIds().length > 0,
        // Always allow paste if we have something in internal clipboard OR 
        // if we want to allow system clipboard paste attempts (which we do)
        hasCopiedElements: globalCopiedElements.length > 0 || currentRef.getCopiedElements().length > 0 || true
      });
    }
  }, [globalCopiedElements]);

  // Update edit menu state when selection or tab changes
  useEffect(() => {
    updateEditMenuState();
  }, [selectedElement, activeTabId, updateEditMenuState, globalCopiedElements]);

  /** @brief Get the current active DrawArea ref */
  const getCurrentDrawAreaRef = useCallback(() => drawAreaRefs.current.get(activeTabId), [activeTabId]);

  // Menu state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  /** @brief Project name state */
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState(projectName);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  /** @brief Panel widths and layout dimensions */
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8
  const [propertiesWidth, setPropertiesWidth] = useState(220);
  const tabPanelHeight= 40;

  /** @brief UI state for editor modal and drawing area */
  const [showEditor, setShowEditor] = useState(false);
  
  // A4 page size at 96 DPI: 210mm × 297mm
  const A4_WIDTH = 794;  // ~210mm at 96 DPI
  const A4_HEIGHT = 1123; // ~297mm at 96 DPI
  const [drawAreaSize, setDrawAreaSize] = useState({ width: A4_WIDTH, height: A4_HEIGHT });
  const [zoom, setZoom] = useState(1);

  // Update the stable ref when active tab changes
  useEffect(() => {
    const newRef = getCurrentDrawAreaRef() || null;
    logger.debug("RailwayDrawerApp", "Active tab changed", {
      activeTabId,
      hasRef: !!newRef,
      elementsCount: newRef?.getElements()?.length || 0,
      selectedElementId: selectedElement?.id
    });
    
    currentDrawAreaRefObject.current = newRef;
    
    // Clear selected element if it doesn't exist in the new tab
    if (selectedElement && newRef) {
      const elements = newRef.getElements();
      const elementExists = elements.find(el => el.id === selectedElement.id);
      if (!elementExists) {
        logger.debug("RailwayDrawerApp", "Clearing stale selected element on tab switch");
        setSelectedElement(undefined);
      }
    }
  }, [activeTabId, selectedElement, getCurrentDrawAreaRef]);

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
        logger.debug("RailwayDrawerApp", "Tab create: Synced clipboard", { elementCount: currentCopiedElements.length });
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
        logger.debug("RailwayDrawerApp", "Tab switch: Synced clipboard", { elementCount: currentCopiedElements.length });
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
  /**
   * @brief Effect to update DrawArea when active tab changes
   * @details Synchronizes DrawArea content with the active tab's elements, grid, and background
   */
  useEffect(() => {
    // Small delay to ensure DrawArea component is mounted
    const timer = setTimeout(() => {
      const currentDrawAreaRef = getCurrentDrawAreaRef();
      if (currentDrawAreaRef && activeTab) {
        logger.debug("RailwayDrawerApp", "Switching to tab", { 
          tabId: activeTab.id, 
          elementCount: activeTab.elements.length 
        });
        
        // Set elements first
        currentDrawAreaRef.setElements(activeTab.elements);
        currentDrawAreaRef.setGridVisible(activeTab.gridVisible);
        
        // Sync global clipboard with DrawArea
        if (globalCopiedElements.length > 0) {
          currentDrawAreaRef.setCopiedElements(globalCopiedElements);
          logger.debug("RailwayDrawerApp", "Tab load: Synced clipboard", { elementCount: globalCopiedElements.length });
        }
        
        const svgElement = currentDrawAreaRef.getSvgElement();
        if (svgElement) {
          svgElement.style.backgroundColor = activeTab.backgroundColor;
        }
      } else {
        logger.warn("RailwayDrawerApp", "DrawArea ref not found", { tabId: activeTabId });
      }
    }, 50); // Small delay to ensure component is mounted

    return () => clearTimeout(timer);
  }, [activeTabId, activeTab, getCurrentDrawAreaRef]);

  /**
   * @brief Dummy setter for dragged item (required by Toolbox component)
   * @details This is a placeholder function to satisfy the Toolbox interface
   */
  const setDraggedItem = () => {};

  /**
   * @brief Handle global copy operation across tabs
   * @details Copies selected elements to app-level clipboard for cross-tab functionality
   */
  const handleGlobalCopy = useCallback(() => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (!currentDrawAreaRef) {
      logger.warn("RailwayDrawerApp", "Cannot copy: No active DrawArea ref found");
      return;
    }

    try {
      // 1. Tell the DrawArea to copy locally first
      currentDrawAreaRef.copySelectedElements();
      
      // 2. Get the copied elements from DrawArea and sync to global clipboard
      const elementsToCopy = currentDrawAreaRef.getCopiedElements();
      
      if (elementsToCopy.length === 0) {
        logger.warn("RailwayDrawerApp", "No elements selected for copying");
        return;
      }
      
      setGlobalCopiedElements(elementsToCopy);
      logger.info("RailwayDrawerApp", "Global copy successful", { elementCount: elementsToCopy.length });
    } catch (error) {
      logger.error("RailwayDrawerApp", "Error during global copy", error);
    }
  }, [getCurrentDrawAreaRef, setGlobalCopiedElements]);

  /**
   * @brief Handle global paste operation across tabs
   * @details Pastes elements from system clipboard or app-level clipboard
   */
  const handleGlobalPaste = useCallback(async (e?: ClipboardEvent) => {
    const currentRef = getCurrentDrawAreaRef();
    if (!currentRef) {
      logger.warn("RailwayDrawerApp", "Cannot paste: No active DrawArea ref found");
      return;
    }

    try {
      // Step 1: prioritize system clipboard and local tab elements via unified paste logic
      logger.info("RailwayDrawerApp", "🔄 Attempting unified paste logic");
      const success = await currentRef.performUnifiedPaste(e);
      
      // Step 2: if unified paste didn't find anything, try global (cross-tab) elements
      if (!success && globalCopiedElements.length > 0) {
        if (e) e.preventDefault();
        logger.info("RailwayDrawerApp", "🍽️ System/Local empty, using global (cross-tab) clipboard", { count: globalCopiedElements.length });
        currentRef.setCopiedElements(globalCopiedElements);
        currentRef.pasteElements();
      } else if (!success) {
        logger.warn("RailwayDrawerApp", "No elements in any clipboard to paste");
      }
    } catch (error) {
      logger.error("RailwayDrawerApp", "Error during global paste", error);
    }
  }, [getCurrentDrawAreaRef, globalCopiedElements]);

  /**
   * @brief Handle global cut operation across tabs
   * @details Cuts selected elements to app-level clipboard
   */
  const handleGlobalCut = useCallback(() => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    if (!currentDrawAreaRef) {
      logger.warn("RailwayDrawerApp", "Cannot cut: No active DrawArea ref found");
      return;
    }

    try {
      // 1. Tell the DrawArea to cut locally first
      currentDrawAreaRef.cutSelectedElements();
      
      // 2. Get the cut elements from DrawArea and sync to global clipboard
      const elementsToCut = currentDrawAreaRef.getCopiedElements();
      
      if (elementsToCut.length === 0) {
        logger.warn("RailwayDrawerApp", "No elements selected for cutting");
        return;
      }
      
      setGlobalCopiedElements(elementsToCut);
      logger.info("RailwayDrawerApp", "Global cut successful", { elementCount: elementsToCut.length });
    } catch (error) {
      logger.error("RailwayDrawerApp", "Error during global cut", error);
    }
  }, [getCurrentDrawAreaRef, setGlobalCopiedElements]);

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

      // Skip if any menu is currently open
      if (activeMenu || activeSubMenu) {
        return;
      }

      // Global Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        e.stopPropagation();
        handleGlobalCopy();
      }
      
      // Global Cut (Ctrl+X)  
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        e.stopPropagation();
        handleGlobalCut();
      }
      
      // Global Paste (Ctrl+V) - we let the browser fire the 'paste' event
      // so handlePaste can catch it with the full clipboard data.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        logger.info("RailwayDrawerApp", "📋 Paste shortcut detected (keydown)");
        // Optional: ensure SVG is focused to receive the paste event reliably
        const currentRef = getCurrentDrawAreaRef();
        if (currentRef && document.activeElement !== currentRef.getSvgElement()) {
          logger.debug("RailwayDrawerApp", "Focusing SVG to receive paste event");
          currentRef.getSvgElement()?.focus();
        }
      }
      
      // Global Delete
      if (e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        const currentRef = getCurrentDrawAreaRef();
        if (currentRef) {
          currentRef.deleteSelectedElements();
          updateEditMenuState();
        }
      }
      
      // Global Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const currentRef = getCurrentDrawAreaRef();
        if (currentRef) {
          currentRef.undo();
          updateEditMenuState();
        }
      }
      
      // Global Redo (Ctrl+Y or Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        e.stopPropagation();
        const currentRef = getCurrentDrawAreaRef();
        if (currentRef) {
          currentRef.redo();
          updateEditMenuState();
        }
      }
      
      // Global Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        const currentRef = getCurrentDrawAreaRef();
        if (currentRef) {
          currentRef.selectAllElements();
          updateEditMenuState();
        }
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      // Direct call to global paste handler which now accepts event
      handleGlobalPaste(e);
    };

    // Use capture phase to ensure we get the event before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("paste", handlePaste as any, true);
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("paste", handlePaste as any, true);
    };
  }, [globalCopiedElements, activeTabId, handleGlobalCopy, handleGlobalCut, handleGlobalPaste, activeMenu, activeSubMenu, getCurrentDrawAreaRef, updateEditMenuState]);

  /**
   * @brief Saves current drawing elements as a JSON file
   * @details Exports all elements from the current tab to a downloadable JSON file using project name
   */
  const saveAsJson = useCallback(() => {
    // Guard against multiple rapid saves
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    
    setTimeout(() => {
      const currentDrawAreaRef = getCurrentDrawAreaRef();
      const elements = currentDrawAreaRef?.getElements?.();
      if (!elements) {
        isSavingRef.current = false;
        return;
      }
      const data = JSON.stringify({ elements }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${projectName}.json`;
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.body.removeChild(link);
      
      // Clean up and reset flag
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
        isSavingRef.current = false;
      }, 500);
    }, 0);
  }, [getCurrentDrawAreaRef, projectName]);

  /**
   * @brief Loads drawing elements from a JSON file
   * @param e The file input change event
   * @details Parses JSON file and loads elements into the current drawing area
   */
  const loadFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Extract filename without extension and set as project name
      const filenameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      setProjectName(filenameWithoutExtension);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            const currentDrawAreaRef = getCurrentDrawAreaRef();
            if (currentDrawAreaRef && parsed.elements) {
              currentDrawAreaRef.setElements(parsed.elements || []);
              
              // Calculate bounds of all loaded elements and expand canvas if needed
              if (parsed.elements.length > 0) {
                let maxX = 0;
                let maxY = 0;
                
                parsed.elements.forEach((el: DrawElement) => {
                  // Calculate the maximum extent of each element
                  const endX = Math.max(el.start.x, el.end?.x || el.start.x);
                  const endY = Math.max(el.start.y, el.end?.y || el.start.y);
                  
                  // Add element width/height if available
                  const elementMaxX = endX + (el.width || 0);
                  const elementMaxY = endY + (el.height || 0);
                  
                  maxX = Math.max(maxX, elementMaxX);
                  maxY = Math.max(maxY, elementMaxY);
                });
                
                // Expand canvas using page-based system
                expandCanvasIfNeeded({ maxX, maxY });
              }
            }
          } catch {
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
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  /**
   * @brief Exports the drawing as an image file
   * @details Supports PNG, JPG, SVG, and PDF formats using html-to-image and jsPDF libraries
   */
  const exportToImage = (format: "png" | "jpg" | "svg" | "pdf") => {
    const currentDrawAreaRef = getCurrentDrawAreaRef();
    const node = currentDrawAreaRef?.getSvgElement?.();
    if (!node) return;
    
    // Handle SVG export directly
    if (format === "svg") {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(node);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "railway_drawing.svg";
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.body.removeChild(link);
      return;
    }
    
    // Handle PDF export
    if (format === "pdf") {
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
      const fn = format === "jpg" ? htmlToImage.toJpeg : htmlToImage.toPng;
      fn(node as unknown as HTMLElement).then((dataUrl: string) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `railway_drawing.${format}`;
        document.body.appendChild(link);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        document.body.removeChild(link);
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
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.body.removeChild(link);
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
              parsed.map((item: unknown) => {
                const toolboxItem = item as { iconSource?: string; iconSvg?: string; shape?: string; iconName?: string };
                return {
                  ...toolboxItem,
                  iconSvg: toolboxItem.iconSource === "custom" ? toolboxItem.iconSvg || toolboxItem.shape : undefined,
                  iconName: toolboxItem.iconName,
                };
              })
            );
          } catch {
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
   * @brief Expand canvas to accommodate elements that extend beyond current bounds
   * @param elementBounds The bounding box of elements {maxX, maxY}
   */
  const expandCanvasIfNeeded = useCallback((elementBounds: { maxX: number; maxY: number; minX?: number; minY?: number }) => {
    const padding = 100; // Padding around elements
    
    // Handle expansion in all directions
    const minX = elementBounds.minX !== undefined ? elementBounds.minX : 0;
    const minY = elementBounds.minY !== undefined ? elementBounds.minY : 0;
    
    // Calculate required width and height
    let requiredWidth = elementBounds.maxX + padding;
    let requiredHeight = elementBounds.maxY + padding;
    
    // If elements go to the left or top (negative), we need to expand left/top
    // For simplicity, we'll expand canvas to include all content and keep origin at 0
    if (minX < 0) {
      requiredWidth = Math.abs(minX) + elementBounds.maxX + padding;
    }
    if (minY < 0) {
      requiredHeight = Math.abs(minY) + elementBounds.maxY + padding;
    }
    
    // Calculate how many A4 pages we need in each direction
    const pagesWide = Math.ceil(requiredWidth / A4_WIDTH);
    const pagesTall = Math.ceil(requiredHeight / A4_HEIGHT);
    
    // New canvas size is a multiple of A4 pages
    const newWidth = pagesWide * A4_WIDTH;
    const newHeight = pagesTall * A4_HEIGHT;
    
    // Only update if we need more space
    if (newWidth > drawAreaSize.width || newHeight > drawAreaSize.height) {
      setDrawAreaSize({
        width: Math.max(newWidth, drawAreaSize.width),
        height: Math.max(newHeight, drawAreaSize.height)
      });
      logger.info("RailwayDrawerApp", "Canvas expanded", {
        pages: { wide: pagesWide, tall: pagesTall },
        size: { width: newWidth, height: newHeight },
        elementBounds: { minX, minY, maxX: elementBounds.maxX, maxY: elementBounds.maxY }
      });
    }
  }, [A4_WIDTH, A4_HEIGHT, drawAreaSize.width, drawAreaSize.height]);

  /**
   * @brief Effect to monitor container size and expand canvas when zooming
   */
  useEffect(() => {
    const container = drawAreaPanelRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver(() => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      
      // Calculate how much canvas space is visible at current zoom
      const visibleWidth = containerWidth / zoom;
      const visibleHeight = containerHeight / zoom;
      
      // Ensure canvas is at least as large as the visible area
      const pagesWide = Math.ceil(visibleWidth / A4_WIDTH);
      const pagesTall = Math.ceil(visibleHeight / A4_HEIGHT);
      
      const minWidth = pagesWide * A4_WIDTH;
      const minHeight = pagesTall * A4_HEIGHT;
      
      if (minWidth > drawAreaSize.width || minHeight > drawAreaSize.height) {
        setDrawAreaSize({
          width: Math.max(minWidth, drawAreaSize.width),
          height: Math.max(minHeight, drawAreaSize.height)
        });
      }
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, [zoom, A4_WIDTH, A4_HEIGHT, drawAreaSize.width, drawAreaSize.height]);

  /**
   * @brief Effect to handle clicking outside menus to close them
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If we have an active menu and the click wasn't on a menu element, close the menu
      if (activeMenu) {
        const target = event.target as Element;
        const isMenuClick = target.closest('.menu-bar') || target.closest('[data-menu]');
        if (!isMenuClick) {
          setActiveMenu(null);
          setActiveSubMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

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

  /**
   * @brief Handle starting to edit project name
   */
  const handleStartEditProjectName = () => {
    setProjectNameInput(projectName);
    setIsEditingProjectName(true);
    setTimeout(() => {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }, 0);
  };

  /**
   * @brief Handle saving the project name
   */
  const handleSaveProjectName = () => {
    const trimmedName = projectNameInput.trim();
    if (trimmedName) {
      setProjectName(trimmedName);
    }
    setIsEditingProjectName(false);
  };

  /**
   * @brief Handle canceling project name edit
   */
  const handleCancelEditProjectName = () => {
    setIsEditingProjectName(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50">
      {/* Project Name Header */}
      <div className="flex bg-white border-b border-slate-200 h-8 items-center px-3 relative z-50 shadow-xs gap-2">
        <Train size={16} className="text-blue-600 flex-shrink-0" />
        {isEditingProjectName ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={projectNameInputRef}
              type="text"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveProjectName();
                if (e.key === 'Escape') handleCancelEditProjectName();
              }}
              className="flex-1 px-2 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Project name..."
            />
            <button
              onClick={handleSaveProjectName}
              className="p-0.5 hover:bg-green-100 rounded transition-colors"
              title="Save"
            >
              <Check size={14} className="text-green-600" />
            </button>
            <button
              onClick={handleCancelEditProjectName}
              className="p-0.5 hover:bg-red-100 rounded transition-colors"
              title="Cancel"
            >
              <X size={14} className="text-red-600" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEditProjectName}
            className="flex items-center gap-2 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors flex-1 justify-between"
            title="Click to edit project name"
          >
            <span>{projectName}</span>
            <Edit2 size={12} className="text-slate-400" />
          </button>
        )}
      </div>
      
      {/* --- Modern Menu Bar --- */}
      <div className="flex bg-white border-b border-slate-200 h-10 items-stretch relative z-50 shadow-sm menu-bar">
        {/* File Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="bg-white hover:bg-slate-50 text-slate-700 border-none px-4 h-10 text-sm font-medium cursor-pointer outline-none border-r border-slate-200 transition-colors duration-200 flex items-center">
            File
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute left-0 mt-2 w-56 origin-top-right bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]">
              <div className="px-1 py-1 ">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isOpeningFileRef.current) return;
                        isOpeningFileRef.current = true;
                        setTimeout(() => {
                          fileInputRef.current?.click();
                          setTimeout(() => {
                            isOpeningFileRef.current = false;
                          }, 500);
                        }, 0);
                      }}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Open Project...
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={saveAsJson}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Save Project
                    </button>
                  )}
                </Menu.Item>
              </div>
              <div className="px-1 py-1" onMouseLeave={() => setActiveSubMenu(null)}>
                <div className="relative">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onMouseEnter={() => setActiveSubMenu('export')}
                        className={`${
                          active ? 'bg-blue-500 text-white' : ''
                        } text-slate-900 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        Export As
                        <span className="ml-auto">›</span>
                      </button>
                    )}
                  </Menu.Item>
                  <Transition
                    as={Fragment}
                    show={activeSubMenu === 'export'}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <div 
                      className="absolute left-full -top-1 w-56 origin-top-left bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      onMouseEnter={() => setActiveSubMenu('export')}
                    >
                      <div className="px-1 py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button onClick={() => { exportToImage("png"); setActiveMenu(null); setActiveSubMenu(null); }} className={`${ active ? 'bg-blue-500 text-white' : 'text-slate-900' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                              PNG
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button onClick={() => { exportToImage("jpg"); setActiveMenu(null); setActiveSubMenu(null); }} className={`${ active ? 'bg-blue-500 text-white' : 'text-slate-900' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                              JPG
                            </button>
                          )}
                        </Menu.Item>
                         <Menu.Item>
                          {({ active }) => (
                            <button onClick={() => { exportToImage("svg"); setActiveMenu(null); setActiveSubMenu(null); }} className={`${ active ? 'bg-blue-500 text-white' : 'text-slate-900' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                              SVG
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button onClick={() => { exportToImage("pdf"); setActiveMenu(null); setActiveSubMenu(null); }} className={`${ active ? 'bg-blue-500 text-white' : 'text-slate-900' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                              PDF
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
              <div className="px-1 py-1" onMouseLeave={() => setActiveSubMenu(null)}>
                <div className="relative">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onMouseEnter={() => setActiveSubMenu('toolbox')}
                        className={`${
                          active ? 'bg-blue-500 text-white' : ''
                        } text-slate-900 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        Manage Toolbox
                        <span className="ml-auto">›</span>
                      </button>
                    )}
                  </Menu.Item>
                  <Transition
                    as={Fragment}
                    show={activeSubMenu === 'toolbox'}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <div 
                      className="absolute left-full -top-1 w-56 origin-top-left bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      onMouseEnter={() => setActiveSubMenu('toolbox')}
                    >
                      <div className="px-1 py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => saveToolboxAsJson()}
                              className={`${
                                active ? 'bg-blue-500 text-white' : 'text-slate-900'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                            >
                              Save Toolbox
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isOpeningToolboxRef.current) return;
                                isOpeningToolboxRef.current = true;
                                setTimeout(() => {
                                  toolboxInputRef.current?.click();
                                  setTimeout(() => {
                                    isOpeningToolboxRef.current = false;
                                  }, 500);
                                }, 0);
                              }}
                              className={`${
                                active ? 'bg-blue-500 text-white' : 'text-slate-900'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                            >
                              Load Toolbox
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => setShowEditor(true)}
                              className={`${
                                active ? 'bg-blue-500 text-white' : 'text-slate-900'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                            >
                              Add New Shape
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={loadFromJson}
        />
        <input
            ref={toolboxInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={loadToolboxFromJson}
        />
        
        {/* Edit Menu */}
        <EditMenu
          canUndo={editMenuState.canUndo}
          canRedo={editMenuState.canRedo}
          hasSelection={editMenuState.hasSelection}
          hasCopiedElements={editMenuState.hasCopiedElements}
          onUndo={() => {
            logger.debug("RailwayDrawerApp", "Undo action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.undo();
            updateEditMenuState();
          }}
          onRedo={() => {
            logger.debug("RailwayDrawerApp", "Redo action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.redo();
            updateEditMenuState();
          }}
          onCopy={() => {
            logger.debug("RailwayDrawerApp", "Copy action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.copySelectedElements();
            updateEditMenuState();
          }}
          onCut={() => {
            logger.debug("RailwayDrawerApp", "Cut action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.cutSelectedElements();
            updateEditMenuState();
          }}
          onPaste={() => {
            logger.debug("RailwayDrawerApp", "Paste action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.pasteElements();
            updateEditMenuState();
          }}
          onDelete={() => {
            logger.debug("RailwayDrawerApp", "Delete action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.deleteSelectedElements();
            updateEditMenuState();
          }}
          onSelectAll={() => {
            logger.debug("RailwayDrawerApp", "Select All action triggered", { hasRef: !!currentDrawAreaRefObject.current });
            currentDrawAreaRefObject.current?.selectAllElements();
            updateEditMenuState();
          }}
        />
        
        {/* View Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="bg-white hover:bg-slate-50 text-slate-700 border-none px-4 h-10 text-sm font-medium cursor-pointer outline-none border-r border-slate-200 transition-colors duration-200 flex items-center">
            View
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-right bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]">
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleZoomIn}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Zoom In
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleZoomOut}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Zoom Out
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleZoomReset}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Zoom to 100%
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        
        {/* Arrange Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="bg-white hover:bg-slate-50 text-slate-700 border-none px-4 h-10 text-sm font-medium cursor-pointer outline-none border-r border-slate-200 transition-colors duration-200 flex items-center">
            Arrange
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-right bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]">
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => {
                        currentDrawAreaRefObject.current?.bringToFront();
                        updateEditMenuState();
                      }}
                      disabled={!editMenuState.hasSelection}
                      className={`${
                        editMenuState.hasSelection ? (active ? 'bg-blue-500 text-white' : 'text-slate-900') : 'text-slate-400 cursor-not-allowed'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Bring to Front
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => {
                        currentDrawAreaRefObject.current?.sendToBack();
                        updateEditMenuState();
                      }}
                      disabled={!editMenuState.hasSelection}
                      className={`${
                        editMenuState.hasSelection ? (active ? 'bg-blue-500 text-white' : 'text-slate-900') : 'text-slate-400 cursor-not-allowed'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      Send to Back
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        
        {/* Help Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="bg-white hover:bg-slate-50 text-slate-700 border-none px-4 h-10 text-sm font-medium cursor-pointer outline-none border-r border-slate-200 transition-colors duration-200 flex items-center">
            Help
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-right bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]">
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setShowAbout(true)}
                      className={`${
                        active ? 'bg-blue-500 text-white' : 'text-slate-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    >
                      About Railway Drawer
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        
        {/* App Title */}
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-sm font-semibold text-slate-700">Railway Drawer <span className="text-xs text-slate-500 font-normal">v{APP_VERSION}</span></h1>
        </div>
      </div>
      
      {/* Main Layout */}
      <div className="flex flex-row w-screen min-w-0 flex-1 overflow-hidden" style={{ height: `calc(100vh - ${tabPanelHeight}px)` }}>
        <div
          style={{ width: toolboxWidth, minWidth: 120 }}
          className="flex flex-col"
        >
          <div className="flex-1 overflow-hidden">
            <Toolbox
              toolbox={toolbox}
              setToolbox={setToolbox}
              showEditor={showEditor}
              setShowEditor={setShowEditor}
              setDraggedItem={setDraggedItem}
            />
          </div>
          <div style={{ height: '200px' }}>
            <LayersPanel 
              layers={layers}
              activeLayerId={activeLayerId}
              onLayerToggleVisibility={handleLayerToggleVisibility}
              onLayerToggleLock={handleLayerToggleLock}
              onLayerSelect={setActiveLayerId}
              onAddLayer={handleAddLayer}
            />
          </div>
        </div>
        
        <div
          className="w-1.5 cursor-ew-resize bg-slate-300 hover:bg-slate-400 transition-colors duration-200 z-10"
          onMouseDown={startResizeToolbox}
        />
        
        <div
          ref={drawAreaPanelRef}
          className="flex-1 min-w-0 flex flex-col bg-white"
        >
          <div className="flex gap-2 items-center p-2 bg-white border-b border-slate-200">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-slate-50 rounded-md p-1 border border-slate-200">
              <button 
                onClick={handleZoomOut}
                className="w-7 h-7 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-medium transition-colors"
                title="Zoom out"
              >
                −
              </button>
              <span className="text-xs font-medium text-slate-700 min-w-[2.5rem] text-center px-1">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={handleZoomIn}
                className="w-7 h-7 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-medium transition-colors"
                title="Zoom in"
              >
                +
              </button>
            </div>

            <button 
              onClick={handleZoomReset}
              className="px-2 h-7 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs text-slate-600 font-medium transition-colors"
              title="Reset zoom to 100%"
            >
              Fit
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Drawing tools */}
            <div className="flex bg-slate-50 rounded-md border border-slate-200 p-0.5">
              <button
                onClick={() => setActiveTool('select')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                  activeTool === 'select' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Selection Tool (V)"
              >
                <MousePointer2 size={14} />
              </button>
              <button
                onClick={() => setActiveTool('measure')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                  activeTool === 'measure' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Measurement Tool (M)"
              >
                <Ruler size={14} />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Additional tools placeholder */}
            <div className="flex bg-slate-50 rounded-md border border-slate-200 p-0.5">
              <button
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 text-xs hover:text-slate-600"
                title="More tools"
                disabled
              >
                ⋯
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 ml-auto" />

            {/* Help button */}
            <button
              className="px-2 h-7 rounded text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setShowAbout(true)}
              title="About Railway Drawer"
            >
              ?
            </button>
          </div>

          {/* Render DrawArea for each tab, toggling visibility based on activeTabId */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === activeTabId ? 'block flex-1 overflow-auto' : 'hidden'}
              style={{ position: 'relative' }}
            >
              <DrawArea
                ref={(ref) => setDrawAreaRef(tab.id, ref)}
                GRID_WIDTH={drawAreaSize.width}
                GRID_HEIGHT={drawAreaSize.height}
                GRID_SIZE={GRID_SIZE}
                zoom={zoom}
                activeTool={activeTool}
                layers={layers}
                activeLayerId={activeLayerId}
                setSelectedElement={setSelectedElement}
                onStateChange={updateEditMenuState}
                disableKeyboardHandlers={true}
                onCanvasExpand={expandCanvasIfNeeded}
              />
            </div>
          ))}
        </div>
        
        <div
          className="w-1.5 cursor-ew-resize bg-slate-300 hover:bg-slate-400 transition-colors duration-200 z-10"
          onMouseDown={startResizeProperties}
        />
        
        <div
          className="panel bg-white"
          style={{ width: propertiesWidth, minWidth: 180 }}
        >
          <EnhancedPropertiesPanel
            drawAreaRef={currentDrawAreaRefObject}
            selectedElement={selectedElement}
            onElementChange={setSelectedElement}
          />
        </div>
      </div>

      {/* Bottom Page Manager */}
      <PageManager
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={handleTabChange}
        onAddTab={handleTabCreate}
        onDeleteTab={handleTabClose}
      />
      
      {/* About Dialog */}
      {showAbout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]" onClick={() => setShowAbout(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Railway Drawer</h2>
            <div className="space-y-3 text-slate-600">
              <p><strong>Version:</strong> {APP_VERSION}</p>
              <p><strong>Author:</strong> {APP_AUTHOR}</p>
              <p className="text-sm mt-4 pt-4 border-t border-slate-200">
                A modern, interactive railway diagram editor built with React, TypeScript, and Vite.
              </p>
              <p className="text-sm">
                Create professional railway schematics with advanced drawing tools, customizable elements, and comprehensive export capabilities.
              </p>
            </div>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RailwayDrawerApp;

