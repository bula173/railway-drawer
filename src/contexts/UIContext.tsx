import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface UIContextType {
  // Menu state
  activeMenu: string | null;
  activeSubMenu: string | null;
  setActiveMenu: (menu: string | null) => void;
  setActiveSubMenu: (submenu: string | null) => void;

  // Panel visibility
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Modals
  showAbout: boolean;
  setShowAbout: (show: boolean) => void;
  showEditor: boolean;
  setShowEditor: (show: boolean) => void;

  // Project name editing
  isEditingProjectName: boolean;
  projectNameInput: string;
  setEditingProjectName: (editing: boolean) => void;
  setProjectNameInput: (name: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isEditingProjectName, setEditingProjectName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');

  const toggleLeftPanel = useCallback(() => {
    setLeftCollapsed(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightCollapsed(prev => !prev);
  }, []);

  const value: UIContextType = {
    activeMenu,
    activeSubMenu,
    setActiveMenu,
    setActiveSubMenu,
    leftCollapsed,
    rightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    showAbout,
    setShowAbout,
    showEditor,
    setShowEditor,
    isEditingProjectName,
    projectNameInput,
    setEditingProjectName,
    setProjectNameInput,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};
