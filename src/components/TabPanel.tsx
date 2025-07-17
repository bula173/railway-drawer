import React, { useState } from 'react';
import type { DrawElement } from './Elements';

export interface DrawAreaTab {
  id: string;
  name: string;
  elements: DrawElement[];
  gridVisible: boolean;
  backgroundColor: string;
  selectedElementIds?: string[]; // Add this property
}

interface TabPanelProps {
  tabs: DrawAreaTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabCreate: () => void;
  onTabClose: (tabId: string) => void;
  onTabRename: (tabId: string, newName: string) => void;
}

const TabPanel: React.FC<TabPanelProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabCreate,
  onTabClose,
  onTabRename,
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleTabDoubleClick = (tab: DrawAreaTab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const handleNameSubmit = () => {
    if (editingTabId && editingName.trim()) {
      onTabRename(editingTabId, editingName.trim());
    }
    setEditingTabId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingName('');
    }
  };

  return (
    <div className="w-full h-full bg-slate-100 border-t border-slate-200 flex items-center">
      <div className="flex items-center h-full">
        <div className="flex items-center gap-0.5 px-2 h-full">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors duration-200 rounded-t-md border-b-2 min-w-[100px] max-w-[200px] ${
                tab.id === activeTabId 
                  ? 'bg-white border-blue-500 text-slate-900' 
                  : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
              onClick={() => onTabChange(tab.id)}
              onDoubleClick={() => handleTabDoubleClick(tab)}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="bg-transparent outline-none text-sm font-medium w-full"
                />
              ) : (
                <span className="text-sm font-medium truncate">{tab.name}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="w-4 h-4 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors duration-200 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="w-8 h-8 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors duration-200 ml-1"
            onClick={onTabCreate}
            title="Create new tab"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default TabPanel;