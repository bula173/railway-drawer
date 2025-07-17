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
    // Update in DrawArea
    if (drawAreaRef?.current) {
      const elements = drawAreaRef.current.getElements();
      const updatedElements = elements.map(el => 
        el.id === updatedElement.id ? updatedElement : el
      );
      drawAreaRef.current.setElements(updatedElements);
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fill Color:</label>
                <input
                  type="color"
                  value={element.styles?.fill || "#3b82f6"}
                  onChange={(e) => {
                    const updatedElement = { 
                      ...element, 
                      styles: { 
                        ...element.styles, 
                        fill: e.target.value 
                      }
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Color:</label>
                <input
                  type="color"
                  value={element.styles?.stroke || "#1e293b"}
                  onChange={(e) => {
                    const updatedElement = { 
                      ...element, 
                      styles: { 
                        ...element.styles, 
                        stroke: e.target.value 
                      }
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Width:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={element.styles?.strokeWidth || 2}
                  onChange={(e) => {
                    const updatedElement = { 
                      ...element, 
                      styles: { 
                        ...element.styles, 
                        strokeWidth: parseFloat(e.target.value) || 2 
                      }
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opacity:</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={element.styles?.opacity || 1}
                  onChange={(e) => {
                    const updatedElement = { 
                      ...element, 
                      styles: { 
                        ...element.styles, 
                        opacity: parseFloat(e.target.value) || 1 
                      }
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Style:</label>
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
              >
                <option value="none">Solid</option>
                <option value="5,5">Dashed</option>
                <option value="2,2">Dotted</option>
                <option value="10,5,2,5">Dash-Dot</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Text Regions Section */}
        {element.textRegions && element.textRegions.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <div className="font-medium text-slate-700 mb-3">Text Regions</div>
            <div className="space-y-3">
              {element.textRegions.map((region, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-600 mb-2">
                    <span className="font-medium">Region {index + 1}:</span> {region.id}
                  </div>
                  <textarea
                    value={region.text}
                    onChange={(e) => {
                      const updatedRegions = element.textRegions?.map((r, i) =>
                        i === index ? { ...r, text: e.target.value } : r
                      );
                      if (updatedRegions) {
                        const updatedElement = { ...element, textRegions: updatedRegions };
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
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;