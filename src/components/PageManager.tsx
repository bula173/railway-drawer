import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DrawAreaTab } from './TabPanel';

interface PageManagerProps {
  tabs: DrawAreaTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onDeleteTab: (tabId: string) => void;
  onTabRename: (tabId: string, newName: string) => void;
}

/**
 * @brief Page manager component for managing multiple pages/tabs
 * @details Displays page navigation similar to draw.io's bottom panel
 */
export const PageManager: React.FC<PageManagerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onDeleteTab,
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
    <div className="h-9 bg-white border-t border-slate-200 flex items-center px-3 gap-2 overflow-x-auto">
      {/* Add page button - left side */}
      <button
        onClick={onAddTab}
        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Add new page"
      >
        <Plus size={16} />
      </button>

      {/* Page list */}
      <div className="flex items-center gap-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onDoubleClick={() => handleTabDoubleClick(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTabId === tab.id
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            title={tab.name}
          >
            <span>📄</span>
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="bg-transparent outline-none text-xs font-medium w-20"
              />
            ) : (
              <span>Page-{index + 1}</span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTab(tab.id);
                }}
                className="ml-1 p-0 hover:text-red-600 transition-colors"
                title="Delete page"
              >
                <Trash2 size={12} />
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PageManager;
