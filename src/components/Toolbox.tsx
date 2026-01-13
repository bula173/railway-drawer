import React, { useState } from "react";
import Button from "./Button";
import { Plus, Search, ChevronDown } from "lucide-react";
import { generateSVGFromElements } from "./Elements";

/**
 * Groups an array of items by a key function.
 * @template T The type of items in the array.
 * @param arr The array to group.
 * @param key A function that returns the group key for an item.
 * @returns An object mapping group keys to arrays of items.
 */
function groupBy<T>(arr: T[], key: (item: T) => string) {
  return arr.reduce((acc, item) => {
    const group = key(item) || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Type for a toolbox item.
 */
export interface ToolboxItem {
  id: string;
  name: string;
  group?: string;
  iconSvg?: string;
  shape?: string;
  svg?: string;
  shapeElements?: Array<{
    id: string;
    svg: string;
    textRegions?: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      fontSize?: number;
      align?: 'left' | 'center' | 'right';
    }>;
  }>;
  width: number;
  height: number; // <-- fix here
  complex?: boolean; // If true, enable complex element behavior with individual shape resizing
  properties?: Record<string, {
    type: string;
    label?: string;
    default?: any;
    options?: string[];
  }>;
}

/**
 * @function generateIconFromShapeElements
 * @brief Generates icon SVG content from shapeElements for toolbox display
 * @param shapeElements Array of shape elements
 * @returns SVG content as string suitable for icon display
 */
function generateIconFromShapeElements(
  shapeElements: ToolboxItem['shapeElements']
): string {
  if (!shapeElements || shapeElements.length === 0) {
    return '';
  }
  
  try {
    // Generate SVG content from shape elements
    const svgContent = generateSVGFromElements(shapeElements);
    
    if (!svgContent || svgContent.trim() === '') {
      return '';
    }
    
    return svgContent;
  } catch (error) {
    console.error("Error generating icon from shapeElements:", error);
    return '';
  }
}

/**
 * Props for the Toolbox component.
 * @interface ToolboxProps
 * @property toolbox - The array of toolbox items.
 * @property setToolbox - Function to update the toolbox items.
 * @property setDraggedItem - Function to set the currently dragged item.
 * @property showEditor - Optional: Whether the editor modal is shown.
 * @property setShowEditor - Optional: Function to set the editor modal visibility.
 */
interface ToolboxProps {
  toolbox: ToolboxItem[];
  setToolbox: (items: ToolboxItem[] | ((prev: ToolboxItem[]) => ToolboxItem[])) => void;
  setDraggedItem: (item: ToolboxItem | null) => void;
  showEditor?: boolean;
  setShowEditor?: (show: boolean) => void;
}

/**
 * Toolbox component for displaying and managing toolbox items.
 * Allows grouping, drag-and-drop, and adding new custom shapes.
 * 
 * @component
 * @param {ToolboxProps} props - The props for the Toolbox component.
 * @returns {JSX.Element} The rendered Toolbox component.
 */
const Toolbox: React.FC<ToolboxProps> = ({
  toolbox: initialToolbox,
  setToolbox,
  setDraggedItem,
  showEditor: showEditorProp,
  setShowEditor: setShowEditorProp,
}) => {
  // Use prop if provided (from menu), else local state (from Add button)
  const [showEditorLocal, setShowEditorLocal] = useState(false);
  const showEditor = showEditorProp !== undefined ? showEditorProp : showEditorLocal;
  const setShowEditor = setShowEditorProp || setShowEditorLocal;

  const [customData, setCustomData] = useState({
    name: "",
    group: "",
    iconSvg: "default", // Use "default" to indicate using shape as icon
    shape: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='none'/></svg>",
    width: 48,
    height: 48, // <-- fix here
  });

  // Group tools by 'group' property
  const grouped = groupBy(initialToolbox, item => item.group || "Other");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    Object.keys(grouped).reduce((acc, group, index) => {
      acc[group] = index !== 0; // Collapse all groups except the first one
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const [searchQuery, setSearchQuery] = useState("");

  // Filter items based on search query
  const filteredGrouped = searchQuery.trim() === "" 
    ? grouped 
    : Object.entries(grouped).reduce((acc, [group, items]) => {
        const filtered = items.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) {
          acc[group] = filtered;
        }
        return acc;
      }, {} as Record<string, typeof initialToolbox>);

  return (
    <div className="h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Header with search */}
      <div className="border-b border-slate-200 p-3 flex-shrink-0">
        <div className="text-sm font-semibold text-slate-700 mb-2">Shapes</div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search shapes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Scrollable shapes area */}
      <div className="flex-1 overflow-y-auto p-3">
        {Object.entries(filteredGrouped).length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">
            {searchQuery.trim() === "" ? "No shapes available" : "No shapes found"}
          </div>
        ) : (
          Object.entries(filteredGrouped).map(([group, items]) => (
            <div key={group} className="mb-4">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
              >
                <ChevronDown 
                  size={14} 
                  className={`transition-transform ${collapsedGroups[group] ? '-rotate-90' : ''}`}
                />
                <span>{group}</span>
                <span className="text-xs text-slate-400 ml-auto">({items.length})</span>
              </button>
              {!collapsedGroups[group] && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        const { iconSvg, ...rest } = item;
                        e.dataTransfer.setData(
                          "application/railway-item",
                          JSON.stringify({
                            ...rest,
                            iconSvg,
                            svg: iconSvg,
                          })
                        );
                        
                        // Create a custom drag image
                        const dragImageContainer = document.createElement('div');
                        dragImageContainer.style.cssText = `
                          position: absolute;
                          top: -1000px;
                          left: -1000px;
                          width: 56px;
                          height: 56px;
                          background: white;
                          border: 2px solid #3b82f6;
                          border-radius: 6px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                          z-index: 10000;
                        `;
                        
                        // Create the icon content for drag image
                        let iconHtml = '';
                        if (item.iconSvg === "default") {
                          if (item.shapeElements && item.shapeElements.length > 0) {
                            const iconContent = generateIconFromShapeElements(item.shapeElements);
                            if (iconContent) {
                              iconHtml = `<svg width="28" height="28" viewBox="0 0 ${item.width || 48} ${item.height || 48}">${iconContent}</svg>`;
                            }
                          } else if (item.shape) {
                            iconHtml = `<svg width="28" height="28" viewBox="0 0 ${item.width || 48} ${item.height || 48}">${item.shape}</svg>`;
                          }
                        } else if (item.iconSvg) {
                          iconHtml = `<div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">${item.iconSvg}</div>`;
                        }
                        
                        dragImageContainer.innerHTML = iconHtml;
                        document.body.appendChild(dragImageContainer);
                        e.dataTransfer.setDragImage(dragImageContainer, 28, 28);
                        
                        setTimeout(() => {
                          if (document.body.contains(dragImageContainer)) {
                            document.body.removeChild(dragImageContainer);
                          }
                        }, 100);
                      }}
                      onDragEnd={() => setDraggedItem(null)}
                      className="aspect-square rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shadow-xs cursor-grab hover:shadow-md hover:border-blue-300 hover:bg-blue-50 transition-all duration-150 relative group"
                      title={item.name}
                    >
                      {/* Tooltip */}
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {item.name}
                      </div>
                      
                      {/* Icon */}
                      {(() => {
                        if (item.iconSvg === "default") {
                          if (item.shapeElements && item.shapeElements.length > 0) {
                            const iconContent = generateIconFromShapeElements(item.shapeElements);
                            if (iconContent) {
                              return (
                                <svg
                                  width={20}
                                  height={20}
                                  viewBox={`0 0 ${item.width || 48} ${item.height || 48}`}
                                  dangerouslySetInnerHTML={{ __html: iconContent }}
                                />
                              );
                            }
                          } else if (item.shape) {
                            return (
                              <svg
                                width={20}
                                height={20}
                                viewBox={`0 0 ${item.width || 48} ${item.height || 48}`}
                                dangerouslySetInnerHTML={{ __html: item.shape }}
                              />
                            );
                          }
                          return null;
                        } else if (item.iconSvg) {
                          return (
                            <span
                              style={{ display: "inline-block", width: 20, height: 20 }}
                              dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="border-t border-slate-200 p-3 flex-shrink-0 space-y-2">
        <Button
          className="w-full h-9 rounded-md bg-blue-500 hover:bg-blue-600 text-white border-none flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200"
          onClick={() => setShowEditor(true)}
          title="Add new custom shape"
        >
          <Plus size={14} />
          Add Shape
        </Button>
      </div>
      
      {showEditor && (
        <div
          className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-20 z-[1000] flex items-center justify-center"
          onClick={() => setShowEditor(false)}
        >
          <div 
            className="bg-white p-6 rounded-xl min-w-[320px] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-lg mb-3 text-slate-900">
              Add New Shape
            </div>
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                  Name
                </label>
                <input
                  type="text"
                  value={customData.name}
                  onChange={(e) =>
                    setCustomData({ ...customData, name: e.target.value })
                  }
                  className="input"
                />
              </div>
              
              <div>
                <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                  Group
                </label>
                <input
                  type="text"
                  value={customData.group}
                  onChange={(e) =>
                    setCustomData({ ...customData, group: e.target.value })
                  }
                  placeholder="e.g. Tracks, Signals"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                  Icon SVG
                </label>
                <textarea
                  value={customData.iconSvg}
                  onChange={(e) =>
                    setCustomData({ ...customData, iconSvg: e.target.value })
                  }
                  placeholder="<svg ...>...</svg> OR default to use shape as icon."
                  className="input min-h-[40px] resize-y"
                />
              </div>
              
              <div>
                <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                  Shape SVG
                </label>
                <textarea
                  value={customData.shape}
                  onChange={(e) =>
                    setCustomData({ ...customData, shape: e.target.value })
                  }
                  placeholder="<svg ...>...</svg>"
                  className="input min-h-[40px] resize-y"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                    Width
                  </label>
                  <input
                    type="number"
                    value={customData.width}
                    onChange={(e) =>
                      setCustomData({ ...customData, width: Number(e.target.value) })
                    }
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="block font-medium text-sm text-slate-700 mb-1 ml-0">
                    Height
                  </label>
                  <input
                    type="number"
                    value={customData.height}
                    onChange={(e) =>
                      setCustomData({ ...customData, height: Number(e.target.value) })
                    }
                    className="input"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <Button
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                onClick={() => {
                  if (!customData.name) return;
                  setToolbox((prev: ToolboxItem[]) => [
                    ...prev,
                    {
                      ...customData,
                      id:
                        customData.name
                          .toLowerCase()
                          .replace(/\s+/g, "_") +
                        "_" +
                        Math.random().toString(36).slice(2, 7),
                    } as ToolboxItem,
                  ]);
                  setCustomData({
                    name: "Default",
                    group: "Other",
                    iconSvg: "default",
                    shape: "<svg><rect width='48' height='48' fill='none'/></svg>",
                    width: 48,
                    height: 48,
                  });
                  setShowEditor(false);
                }}
              >
                Add
              </Button>
              <Button
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors duration-200 border border-slate-200"
                onClick={() => setShowEditor(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Exports the Toolbox component.
 */
export default Toolbox;
