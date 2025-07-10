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
    <div className="tab-panel">
      <div className="tab-header">
        <div className="tab-list">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
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
                  className="tab-name-input"
                />
              ) : (
                <span className="tab-name">{tab.name}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="tab-close-btn"
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
            className="tab-create-btn"
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