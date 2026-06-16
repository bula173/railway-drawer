import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import type { DrawElement } from '../components/Elements';
import type { DrawAreaTab } from '../components/TabPanel';

export interface DrawingContextType {
  // Elements & Tabs
  tabs: DrawAreaTab[];
  activeTabId: string;
  setTabs: (tabs: DrawAreaTab[]) => void;
  setActiveTabId: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<DrawAreaTab>) => void;

  // Selection
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;
  selectedElement: DrawElement | undefined;
  setSelectedElement: (element: DrawElement | undefined) => void;

  // Layers
  layers: Array<{ id: string; name: string; visible: boolean }>;
  activeLayerId: string;
  setLayers: (layers: Array<{ id: string; name: string; visible: boolean }>) => void;
  setActiveLayerId: (layerId: string) => void;

  // Active Tool
  activeTool: string;
  setActiveTool: (tool: string) => void;

  // Drawing State
  getElements: () => DrawElement[];
  updateElement: (element: DrawElement) => void;
  deleteElements: (ids: string[]) => void;
  addElement: (element: DrawElement) => void;
}

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

export const DrawingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Tabs & Elements
  const [tabs, setTabs] = useState<DrawAreaTab[]>([
    { id: 'tab-1', name: 'Drawing 1', elements: [], gridVisible: true, backgroundColor: '#ffffff' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Selection
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedElement, setSelectedElement] = useState<DrawElement | undefined>(undefined);

  // Layers
  const [layers, setLayers] = useState([
    { id: 'layer-1', name: 'Default', visible: true }
  ]);
  const [activeLayerId, setActiveLayerId] = useState('layer-1');

  // Active Tool
  const [activeTool, setActiveTool] = useState('pointer');

  // Helper functions
  const getElements = useCallback((): DrawElement[] => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    return currentTab?.elements ?? [];
  }, [tabs, activeTabId]);

  const updateTab = useCallback((tabId: string, updates: Partial<DrawAreaTab>) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  const updateElement = useCallback((element: DrawElement) => {
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              elements: tab.elements.map(el => (el.id === element.id ? element : el))
            }
          : tab
      )
    );
  }, [activeTabId]);

  const deleteElements = useCallback((ids: string[]) => {
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              elements: tab.elements.filter(el => !ids.includes(el.id))
            }
          : tab
      )
    );
    setSelectedElementIds([]);
  }, [activeTabId]);

  const addElement = useCallback((element: DrawElement) => {
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, elements: [...tab.elements, element] }
          : tab
      )
    );
  }, [activeTabId]);

  const value: DrawingContextType = {
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    updateTab,
    selectedElementIds,
    setSelectedElementIds,
    selectedElement,
    setSelectedElement,
    layers,
    activeLayerId,
    setLayers,
    setActiveLayerId,
    activeTool,
    setActiveTool,
    getElements,
    updateElement,
    deleteElements,
    addElement,
  };

  return (
    <DrawingContext.Provider value={value}>
      {children}
    </DrawingContext.Provider>
  );
};

export const useDrawing = () => {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error('useDrawing must be used within DrawingProvider');
  }
  return context;
};
