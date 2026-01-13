import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DrawAreaTab } from './TabPanel';

interface PageManagerProps {
  tabs: DrawAreaTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onDeleteTab: (tabId: string) => void;
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
}) => {
  return (
    <div className="h-9 bg-white border-t border-slate-200 flex items-center px-3 gap-2 overflow-x-auto">
      {/* Page list */}
      <div className="flex items-center gap-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTabId === tab.id
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            title={tab.name}
          >
            <span>📄</span>
            <span>Page-{index + 1}</span>
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

      {/* Add page button */}
      <button
        onClick={onAddTab}
        className="ml-auto p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Add new page"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default PageManager;
