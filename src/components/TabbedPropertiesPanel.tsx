import React, { useState } from 'react';

interface TabbedPropertiesPanelProps {
  children: React.ReactNode;
}

/**
 * @brief Tabbed properties panel with Diagram and Style tabs
 * @details Provides organized property editing similar to draw.io
 */
export const TabbedPropertiesPanel: React.FC<TabbedPropertiesPanelProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'diagram' | 'style'>('diagram');

  return (
    <div className="h-full bg-white border-l border-slate-200 flex flex-col">
      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab('diagram')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'diagram'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Diagram
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'style'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Style
        </button>
      </div>

      {/* Tab content - Diagram tab */}
      {activeTab === 'diagram' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* View options section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                View
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Grid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Page View</span>
                </label>
              </div>
            </div>

            {/* Background section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Background
              </h3>
              <button className="text-xs text-blue-600 hover:text-blue-700">
                Change...
              </button>
            </div>

            {/* Options section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Options
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Connection Arrows</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Connection Points</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Guides</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Autosave</span>
                </label>
              </div>
            </div>

            {/* Paper size section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Paper Size
              </h3>
              <select className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>US-Letter (8.5" x 11")</option>
                <option>A4 (210mm x 297mm)</option>
                <option>A3 (297mm x 420mm)</option>
                <option>Custom</option>
              </select>
              <div className="mt-2 flex gap-1">
                <label className="flex items-center gap-1 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="orientation"
                    defaultChecked
                    className="w-3 h-3"
                  />
                  <span className="text-slate-700">Portrait</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="orientation"
                    className="w-3 h-3"
                  />
                  <span className="text-slate-700">Landscape</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab content - Style tab */}
      {activeTab === 'style' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center text-slate-500 py-8">
            {/* Your custom children content goes here */}
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabbedPropertiesPanel;
