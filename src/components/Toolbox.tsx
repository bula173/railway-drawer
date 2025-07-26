import React, { useState } from "react";
import Button from "./Button";
import { Plus } from "lucide-react";
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

  return (
    <div className="h-full bg-white border-r border-slate-200 p-4 overflow-auto">
      <div className="text-lg font-semibold mb-4 text-slate-900 text-center">
        Toolbox
      </div>
      {Object.entries(grouped).map(([group, items]) => (
        <div
          key={group}
          className={`w-full mb-3 ${collapsedGroups[group] ? "collapsed" : ""}`}
        >
          <div
            className="font-semibold text-slate-800 text-base my-2 ml-1 cursor-pointer hover:text-slate-600 transition-colors flex items-center gap-2"
            onClick={() => toggleGroup(group)}
          >
            <span className="text-sm text-slate-500">
              {collapsedGroups[group] ? "▼" : "▲"}
            </span>
            {group}
          </div>
          {!collapsedGroups[group] && (
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2 w-full">
                {items.map((item) => {
                  return (
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
                      }}
                      onDragEnd={() => setDraggedItem(null)}
                      className="aspect-square rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm cursor-grab hover:shadow-md hover:border-slate-300 hover:bg-white transition-all duration-200 relative group"
                      title={item.name}
                    >
                      {/* Tooltip */}
                      <div className="absolute left-1/2 bottom-[-32px] transform -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {item.name}
                      </div>
                      
                      {/* Icon */}
                      {(() => {
                        // Handle "default" iconSvg - generate from shape or shapeElements
                        if (item.iconSvg === "default") {
                          if (item.shapeElements && item.shapeElements.length > 0) {
                            // Generate icon from shapeElements
                            const iconContent = generateIconFromShapeElements(item.shapeElements);
                            if (iconContent) {
                              return (
                                <svg
                                  width={24}
                                  height={24}
                                  viewBox={`0 0 ${item.width || 48} ${item.height || 48}`}
                                  dangerouslySetInnerHTML={{ __html: iconContent }}
                                />
                              );
                            }
                          } else if (item.shape) {
                            // Fallback to legacy shape property
                            return (
                              <svg
                                width={24}
                                height={24}
                                viewBox={`0 0 ${item.width || 48} ${item.height || 48}`}
                                dangerouslySetInnerHTML={{ __html: item.shape }}
                              />
                            );
                          }
                          return null;
                        } else if (item.iconSvg) {
                          // Use explicitly defined iconSvg
                          return (
                            <span
                              style={{ display: "inline-block", width: 24, height: 24 }}
                              dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button
        className="w-full h-10 rounded-lg mt-6 bg-blue-500 hover:bg-blue-600 text-white border-none flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 shadow-sm"
        onClick={() => setShowEditor(true)}
        title="Add new shape"
      >
        <Plus size={16} />
        Add Shape
      </Button>
      
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
