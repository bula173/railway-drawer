import { useCallback, useRef, useEffect, useState } from 'react';
import { useUI } from '../contexts/UIContext';
import { useClipboard } from '../contexts/ClipboardContext';
import { useDrawing } from '../contexts/DrawingContext';
import type { DrawElement } from '../components/Elements';
import type { DrawAreaTab } from '../components/TabPanel';
import { logger } from '../utils/logger';

/**
 * Custom hook that consolidates all state management for RailwayDrawerApp
 * Provides a migration layer from local state to Context API
 *
 * This hook encapsulates:
 * - Tab management
 * - Element selection
 * - Clipboard operations
 * - Project settings
 */
export const useRailwayDrawerState = () => {
  // Use contexts
  const ui = useUI();
  const clipboard = useClipboard();
  const drawing = useDrawing();

  // Additional local state for RailwayDrawerApp-specific features
  const [projectName, setProjectName] = useState('Untitled Project');
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [drawAreaSize, setDrawAreaSize] = useState({ width: 794, height: 1123 }); // A4 size
  const [zoom, setZoom] = useState(1);
  const [showEditor, setShowEditor] = useState(false);

  // Refs for DrawArea instances
  const drawAreaRefs = useRef<Map<string, any>>(new Map());
  const currentDrawAreaRefObject = useRef<any | null>(null);

  const setDrawAreaRef = useCallback((tabId: string, ref: any | null) => {
    if (ref) {
      drawAreaRefs.current.set(tabId, ref);
    } else {
      drawAreaRefs.current.delete(tabId);
    }
  }, []);

  const getCurrentDrawAreaRef = useCallback(() => {
    return drawAreaRefs.current.get(drawing.activeTabId);
  }, [drawing.activeTabId]);

  // Sync current ref when tab changes
  useEffect(() => {
    const ref = getCurrentDrawAreaRef();
    currentDrawAreaRefObject.current = ref;
  }, [getCurrentDrawAreaRef]);

  // Tab operations
  const handleTabCreate = useCallback((initialElements: DrawElement[] = []) => {
    const tabId = `tab-${Date.now()}`;
    const newTab: DrawAreaTab = {
      id: tabId,
      name: `Drawing ${drawing.tabs.length + 1}`,
      elements: initialElements,
      gridVisible: true,
      backgroundColor: '#ffffff',
    };

    drawing.setTabs([...drawing.tabs, newTab]);
    drawing.setActiveTabId(tabId);

    logger.debug('RailwayDrawerApp', 'Created new tab', { tabId, elementCount: initialElements.length });
  }, [drawing]);

  const handleTabDelete = useCallback((tabId: string) => {
    if (drawing.tabs.length <= 1) {
      logger.warn('RailwayDrawerApp', 'Cannot delete last tab');
      return;
    }

    drawing.setTabs(drawing.tabs.filter(t => t.id !== tabId));
    drawAreaRefs.current.delete(tabId);

    // Switch to first remaining tab if deleted tab was active
    if (drawing.activeTabId === tabId) {
      const firstTab = drawing.tabs.find(t => t.id !== tabId);
      if (firstTab) {
        drawing.setActiveTabId(firstTab.id);
      }
    }

    logger.debug('RailwayDrawerApp', 'Deleted tab', { tabId });
  }, [drawing]);

  const handleTabRename = useCallback((tabId: string, newName: string) => {
    drawing.updateTab(tabId, { name: newName });
    logger.debug('RailwayDrawerApp', 'Renamed tab', { tabId, newName });
  }, [drawing]);

  // Element operations
  const copySelectedElements = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (!ref) return;

    const selectedIds = drawing.selectedElementIds;
    if (selectedIds.length === 0) return;

    const elements = ref.getElements();
    const elementsToClip = elements.filter((el: DrawElement) =>
      selectedIds.includes(el.id)
    );

    clipboard.copyToClipboard(elementsToClip);
    logger.info('RailwayDrawerApp', '📋 Copied elements', { count: elementsToClip.length });
  }, [drawing.selectedElementIds, clipboard]);

  const cutSelectedElements = useCallback(() => {
    copySelectedElements();
    const ref = currentDrawAreaRefObject.current;
    if (ref) {
      ref.deleteSelectedElements?.();
    }
  }, [copySelectedElements]);

  const pasteElements = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (!ref) return;

    const elementsToPaste = clipboard.getClipboardElements();
    if (elementsToPaste.length === 0) return;

    ref.pasteElements?.(elementsToPaste);
    logger.info('RailwayDrawerApp', '📌 Pasted elements', { count: elementsToPaste.length });
  }, [clipboard]);

  const deleteSelectedElements = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (ref) {
      ref.deleteSelectedElements?.();
      logger.info('RailwayDrawerApp', '🗑️ Deleted elements', {
        count: drawing.selectedElementIds.length,
      });
    }
  }, [drawing.selectedElementIds]);

  const selectAllElements = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (ref) {
      ref.selectAllElements?.();
    }
  }, []);

  // Undo/Redo
  const undo = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (ref?.undo) {
      ref.undo();
      logger.info('RailwayDrawerApp', '↶ Undo');
    }
  }, []);

  const redo = useCallback(() => {
    const ref = currentDrawAreaRefObject.current;
    if (ref?.redo) {
      ref.redo();
      logger.info('RailwayDrawerApp', '↷ Redo');
    }
  }, []);

  return {
    // UI state from context
    activeMenu: ui.activeMenu,
    setActiveMenu: ui.setActiveMenu,
    activeSubMenu: ui.activeSubMenu,
    setActiveSubMenu: ui.setActiveSubMenu,
    leftCollapsed: ui.leftCollapsed,
    rightCollapsed: ui.rightCollapsed,
    toggleLeftPanel: ui.toggleLeftPanel,
    toggleRightPanel: ui.toggleRightPanel,
    showAbout: ui.showAbout,
    setShowAbout: ui.setShowAbout,
    isEditingProjectName: ui.isEditingProjectName,
    projectNameInput: ui.projectNameInput,
    setEditingProjectName: ui.setEditingProjectName,
    setProjectNameInput: ui.setProjectNameInput,

    // Drawing state from context
    tabs: drawing.tabs,
    activeTabId: drawing.activeTabId,
    setActiveTabId: drawing.setActiveTabId,
    selectedElementIds: drawing.selectedElementIds,
    setSelectedElementIds: drawing.setSelectedElementIds,
    selectedElement: drawing.selectedElement,
    setSelectedElement: drawing.setSelectedElement,
    layers: drawing.layers,
    activeLayerId: drawing.activeLayerId,
    setLayers: drawing.setLayers,
    setActiveLayerId: drawing.setActiveLayerId,
    activeTool: drawing.activeTool,
    setActiveTool: drawing.setActiveTool,
    getElements: drawing.getElements,
    updateElement: drawing.updateElement,
    deleteElements: drawing.deleteElements,
    addElement: drawing.addElement,

    // Clipboard from context
    copiedElements: clipboard.copiedElements,
    setCopiedElements: clipboard.setCopiedElements,

    // Local state
    projectName,
    setProjectName,
    savingStatus,
    setSavingStatus,
    drawAreaSize,
    setDrawAreaSize,
    zoom,
    setZoom,
    showEditor,
    setShowEditor,

    // Refs
    drawAreaRefs,
    currentDrawAreaRefObject,
    setDrawAreaRef,
    getCurrentDrawAreaRef,

    // Tab operations
    handleTabCreate,
    handleTabDelete,
    handleTabRename,

    // Element operations
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    deleteSelectedElements,
    selectAllElements,
    undo,
    redo,
  };
};
