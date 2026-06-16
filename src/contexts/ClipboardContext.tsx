import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { DrawElement } from '../components/Elements';

interface ClipboardContextType {
  copiedElements: DrawElement[];
  setCopiedElements: (elements: DrawElement[]) => void;
  copyToClipboard: (elements: DrawElement[]) => void;
  getClipboardElements: () => DrawElement[];
  clearClipboard: () => void;
}

const ClipboardContext = createContext<ClipboardContextType | undefined>(undefined);

export const ClipboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [copiedElements, setCopiedElements] = useState<DrawElement[]>([]);

  const copyToClipboard = useCallback((elements: DrawElement[]) => {
    setCopiedElements(elements);
  }, []);

  const getClipboardElements = useCallback(() => {
    return copiedElements;
  }, [copiedElements]);

  const clearClipboard = useCallback(() => {
    setCopiedElements([]);
  }, []);

  const value: ClipboardContextType = {
    copiedElements,
    setCopiedElements,
    copyToClipboard,
    getClipboardElements,
    clearClipboard,
  };

  return (
    <ClipboardContext.Provider value={value}>
      {children}
    </ClipboardContext.Provider>
  );
};

export const useClipboard = () => {
  const context = useContext(ClipboardContext);
  if (!context) {
    throw new Error('useClipboard must be used within ClipboardProvider');
  }
  return context;
};
