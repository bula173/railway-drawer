import React, { useState, useEffect } from "react";
import type { DrawElement } from "./Elements";
import type { DrawAreaRef } from "./DrawArea";

/**
 * PropertiesPanel component for displaying and editing properties of a selected drawing element.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {React.RefObject<DrawAreaRef | null>} [props.drawAreaRef] - Reference to DrawArea component.
 * @param {(id: string, name: string) => void} [props.onChangeName] - Handler for name change.
 * @returns {JSX.Element} The rendered properties panel.
 */
const PropertiesPanel: React.FC<{
  drawAreaRef?: React.RefObject<DrawAreaRef | null>; // Reference to DrawArea component
  selectedElement?: DrawElement;
  onElementChange?: (element: DrawElement) => void;
  onChangeName?: (id: string, name: string) => void;
}> = ({
  drawAreaRef,
  selectedElement: element,
  onElementChange,
  onChangeName,
}) => {
  const [gridEnabled, setGridEnabled] = useState(true);
  const [backgroundColor, setLocalBackgroundColor] = useState("#ffffff");

  // Update local grid state when component mounts or drawAreaRef changes
  useEffect(() => {
    const updateState = () => {
      if (drawAreaRef?.current) {
        setGridEnabled(drawAreaRef.current.getGridVisible());
        if (drawAreaRef.current.getBackgroundColor) {
          setLocalBackgroundColor(drawAreaRef.current.getBackgroundColor());
        }
      }
    };
    updateState();
    
    // Only update once when the ref changes, no polling
  }, [drawAreaRef]);

  // Helper function to update element both in DrawArea and callback
  const updateElement = (updatedElement: DrawElement) => {
    console.log("🔄 PropertiesPanel updateElement called:", {
      elementId: updatedElement.id,
      elementType: updatedElement.type,
      hasStyles: !!updatedElement.styles,
      styles: updatedElement.styles,
      hasShape: !!updatedElement.shape,
      shapeLength: updatedElement.shape?.length || 0
    });
    
    // Update in DrawArea
    if (drawAreaRef?.current) {
      const elements = drawAreaRef.current.getElements();
      console.log("📋 Current elements before update:", elements.length);
      
      // Check if the element actually exists in the current DrawArea
      const elementExists = elements.find(el => el.id === updatedElement.id);
      console.log("🔍 Element exists in DrawArea:", !!elementExists);
      
      if (!elementExists) {
        console.error("❌ Element not found in DrawArea! This might be a ref/tab issue.");
        console.log("📋 Available element IDs:", elements.map(el => el.id));
        console.log("🎯 Looking for element ID:", updatedElement.id);
        
        // Clear the selection since the element doesn't exist in current tab
        console.log("🧹 Clearing invalid selection");
        // Note: We can't call onElementChange with undefined due to type constraints
        // The parent component should handle this by checking element existence
        return;
      }
      
      const updatedElements = elements.map(el => 
        el.id === updatedElement.id ? updatedElement : el
      );
      
      console.log("📋 Updated elements array:", updatedElements.length);
      drawAreaRef.current.setElements(updatedElements);
      
      // Verify the update worked
      const newElements = drawAreaRef.current.getElements();
      console.log("✅ Elements after setElements:", newElements.length);
      const updatedEl = newElements.find(el => el.id === updatedElement.id);
      console.log("🎯 Updated element found:", !!updatedEl, updatedEl?.styles);
    } else {
      console.error("❌ No drawAreaRef available");
    }
    
    // Call the callback to update parent state
    onElementChange?.(updatedElement);
  };

  if (!element || !element.id) {
    // Show DrawArea/global properties if nothing is selected
    return (
      <div className="w-full h-full bg-white border-l border-slate-200 p-4 overflow-auto">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Canvas Settings</h2>
        <div className="space-y-4 text-sm text-slate-600">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gridEnabled}
                onChange={e => {
                  const enabled = e.target.checked;
                  setGridEnabled(enabled);
                  if (drawAreaRef?.current) {
                    drawAreaRef.current.setGridVisible(enabled);
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-slate-700">Show Grid</span>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-slate-700">Background Color:</label>
            <input
              type="color"
              value={backgroundColor}
              className="w-12 h-8 border border-slate-300 rounded cursor-pointer"
              onChange={e => {
                const newColor = e.target.value;
                setLocalBackgroundColor(newColor);
                if (drawAreaRef?.current?.setBackgroundColor) {
                  drawAreaRef.current.setBackgroundColor(newColor);
                }
              }}
            />
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="font-medium text-slate-700 mb-2">Canvas Info</div>
            <div className="space-y-1 text-xs">
              <div><span className="font-medium">Elements:</span> {drawAreaRef?.current?.getElements()?.length || 0}</div>
              <div><span className="font-medium">Width:</span> {drawAreaRef?.current?.getSvgElement()?.getAttribute('width') || 'N/A'}</div>
              <div><span className="font-medium">Height:</span> {drawAreaRef?.current?.getSvgElement()?.getAttribute('height') || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Validate that the selected element actually exists in the current DrawArea
  if (drawAreaRef?.current) {
    const currentElements = drawAreaRef.current.getElements();
    const elementExists = currentElements.find(el => el.id === element.id);
    if (!elementExists) {
      console.log("🚨 Selected element doesn't exist in current DrawArea");
      console.log("🔍 Current elements:", currentElements.length, "IDs:", currentElements.map(el => el.id));
      console.log("🔍 Looking for element:", element.id);
      
      // For now, let's still show the properties but with a warning
      // Instead of completely blocking, which might be too aggressive
    }
  }

  // Calculate element properties
  const x = Math.round(element.start?.x ?? 0);
  const y = Math.round(element.start?.y ?? 0);
  const x2 = Math.round(element.end?.x ?? 0);
  const y2 = Math.round(element.end?.y ?? 0);
  const width = Math.abs(x2 - x);
  const height = Math.abs(y2 - y);

  // Show selected element properties
  return (
    <div className="w-full h-full bg-white border-l border-slate-200 p-4 overflow-auto">
      <h2 className="text-lg font-semibold mb-4 text-slate-900">Element Properties</h2>
      <div className="space-y-4 text-sm">
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="space-y-2 text-xs">
            <div><span className="font-medium text-slate-700">ID:</span> <span className="text-slate-600">{element.id}</span></div>
            <div><span className="font-medium text-slate-700">Type:</span> <span className="text-slate-600">{element.type}</span></div>
            <div><span className="font-medium text-slate-700">Position:</span> <span className="text-slate-600">({x}, {y})</span></div>
            <div><span className="font-medium text-slate-700">Size:</span> <span className="text-slate-600">{width} × {height}</span></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="font-medium text-slate-700">Name:</label>
          <textarea
            value={element.name || ""}
            onChange={(e) => {
              const updatedElement = { ...element, name: e.target.value };
              updateElement(updatedElement);
              onChangeName?.(element.id, e.target.value);
            }}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
            placeholder="Enter element name..."
          />
        </div>
        
        {/* Element Styles Section */}
        <div className="border-t border-slate-200 pt-4">
          <div className="font-medium text-slate-700 mb-3">Element Styles</div>
          {element.type === "custom" && element.shape && !element.styles && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Original Toolbox Styling</div>
                <div>This element uses its original toolbox colors. You can override them below if needed.</div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fill Color:</label>
                <div className="relative">
                  <input
                    type="color"
                    value={element.styles?.fill || "#3b82f6"}
                    onChange={(e) => {
                      // Only create styles object if the value is actually different from the fallback
                      const newValue = e.target.value;
                      if (newValue !== "#3b82f6" || element.styles?.fill) {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            fill: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }
                    }}
                    className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                    disabled={!element.styles?.fill}
                  />
                  {!element.styles?.fill && (
                    <button
                      onClick={() => {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            fill: "#3b82f6" 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="absolute inset-0 bg-transparent border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Override
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {element.styles?.fill ? "Custom override" : "Using original colors"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Color:</label>
                <div className="relative">
                  <input
                    type="color"
                    value={element.styles?.stroke || "#1e293b"}
                    onChange={(e) => {
                      // Only create styles object if the value is actually different from the fallback
                      const newValue = e.target.value;
                      if (newValue !== "#1e293b" || element.styles?.stroke) {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            stroke: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }
                    }}
                    className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                    disabled={!element.styles?.stroke}
                  />
                  {!element.styles?.stroke && (
                    <button
                      onClick={() => {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            stroke: "#1e293b" 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="absolute inset-0 bg-transparent border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Override
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {element.styles?.stroke ? "Custom override" : "Using original colors"}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Width:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={element.styles?.strokeWidth || 2}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value) || 2;
                      if (newValue !== 2 || element.styles?.strokeWidth !== undefined) {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            strokeWidth: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                    disabled={element.styles?.strokeWidth === undefined}
                  />
                  {element.styles?.strokeWidth === undefined && (
                    <button
                      onClick={() => {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            strokeWidth: 2 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="absolute inset-0 bg-transparent border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Override
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {element.styles?.strokeWidth !== undefined ? "Custom override" : "Using original width"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opacity:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={element.styles?.opacity || 1}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value) || 1;
                      if (newValue !== 1 || element.styles?.opacity !== undefined) {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            opacity: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }
                    }}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                    disabled={element.styles?.opacity === undefined}
                  />
                  {element.styles?.opacity === undefined && (
                    <button
                      onClick={() => {
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            opacity: 1 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="absolute inset-0 bg-transparent border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Override
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {element.styles?.opacity !== undefined ? "Custom override" : "Using original opacity"}
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Style:</label>
              <div className="relative">
                <select
                  value={element.styles?.strokeDasharray || "none"}
                  onChange={(e) => {
                    const value = e.target.value === "none" ? undefined : e.target.value;
                    const updatedElement = { 
                      ...element, 
                      styles: { 
                        ...element.styles, 
                        strokeDasharray: value 
                      }
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  disabled={element.styles?.strokeDasharray === undefined}
                >
                  <option value="none">Solid</option>
                  <option value="5,5">Dashed</option>
                  <option value="2,2">Dotted</option>
                  <option value="10,5,2,5">Dash-Dot</option>
                </select>
                {element.styles?.strokeDasharray === undefined && (
                  <button
                    onClick={() => {
                      const updatedElement = { 
                        ...element, 
                        styles: { 
                          ...element.styles, 
                          strokeDasharray: "none" 
                        }
                      };
                      updateElement(updatedElement);
                    }}
                    className="absolute inset-0 bg-transparent border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Override
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {element.styles?.strokeDasharray !== undefined ? "Custom override" : "Using original style"}
              </div>
            </div>
            
            {/* Reset to Original Button */}
            {element.styles && (
              <div className="pt-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    const updatedElement = { ...element, styles: undefined };
                    updateElement(updatedElement);
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors duration-200 border border-slate-300"
                >
                  Reset to Original Toolbox Style
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Text Regions Section */}
        {(() => {
          // Collect all textRegions from shapeElements
          const allTextRegions = element.shapeElements?.flatMap((shapeElement, shapeIndex) => 
            shapeElement.textRegions?.map((region, regionIndex) => ({
              ...region,
              shapeElementIndex: shapeIndex,
              regionIndex,
              shapeElementId: shapeElement.id
            })) || []
          ) || [];

          return allTextRegions.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="font-medium text-slate-700 mb-3">Text Regions</div>
              <div className="space-y-3">
                {allTextRegions.map((region, index) => (
                  <div key={`${region.shapeElementId}-${region.regionIndex}`} className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-600 mb-2">
                      <span className="font-medium">Region {index + 1}:</span> {region.id} 
                      <span className="text-slate-400 ml-2">({region.shapeElementId})</span>
                    </div>
                    <textarea
                      value={region.text}
                      onChange={(e) => {
                        // Update the specific textRegion in the specific shapeElement
                        const updatedShapeElements = element.shapeElements?.map((shapeElement, shapeIndex) => {
                          if (shapeIndex === region.shapeElementIndex) {
                            return {
                              ...shapeElement,
                              textRegions: shapeElement.textRegions?.map((r, regionIndex) =>
                                regionIndex === region.regionIndex ? { ...r, text: e.target.value } : r
                              )
                            };
                          }
                          return shapeElement;
                        });
                        
                        if (updatedShapeElements) {
                          const updatedElement = { ...element, shapeElements: updatedShapeElements };
                          updateElement(updatedElement);
                        }
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                      placeholder="Enter text content..."
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default PropertiesPanel;