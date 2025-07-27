import React, { useState } from 'react';
import type { DrawElement } from './Elements';
import type { DrawAreaRef } from './DrawArea';

interface PropertiesPanelProps {
  drawAreaRef?: React.RefObject<DrawAreaRef>;
  selectedElement?: DrawElement | null;
  onElementChange?: (element: DrawElement | undefined) => void;
  onChangeName?: (elementId: string, name: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  drawAreaRef,
  selectedElement, 
  onElementChange,
  onChangeName
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'style' | 'text' | 'arrange'>('general');

  // Function to update an element
  const updateElement = (updatedElement: DrawElement) => {
    if (drawAreaRef?.current) {
      const currentElements = drawAreaRef.current.getElements();
      const updatedElements = currentElements.map(el => 
        el.id === updatedElement.id ? updatedElement : el
      );
      drawAreaRef.current.setElements(updatedElements);
      onElementChange?.(updatedElement);
    }
  };

  // Check if we should show canvas properties (no element selected)
  const showCanvasProperties = !selectedElement;

  if (showCanvasProperties) {
    return (
      <div className="w-full h-full bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Canvas Properties</h2>
        </div>
        
        <div className="flex-1 p-4 overflow-auto">
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Background Color:</label>
                  <input
                    type="color"
                    defaultValue="#ffffff"
                    onChange={(e) => {
                      if (drawAreaRef?.current) {
                        drawAreaRef.current.setBackgroundColor(e.target.value);
                      }
                    }}
                    className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grid Visible:</label>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => {
                      if (drawAreaRef?.current) {
                        drawAreaRef.current.setGridVisible(e.target.checked);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Canvas Width:</label>
                    <input
                      type="number"
                      min="500"
                      max="5000"
                      step="100"
                      defaultValue={2000}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Canvas Height:</label>
                    <input
                      type="number"
                      min="500"
                      max="5000"
                      step="100"
                      defaultValue={1500}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center py-8 text-slate-500">
              <div className="text-2xl mb-2">🎨</div>
              <div className="text-sm">Select an element to edit its properties</div>
              <div className="text-xs mt-1">or modify canvas settings above</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const element = selectedElement;

  // Calculate element properties
  const x = Math.round(element.start?.x ?? 0);
  const y = Math.round(element.start?.y ?? 0);
  const x2 = Math.round(element.end?.x ?? 0);
  const y2 = Math.round(element.end?.y ?? 0);
  const width = Math.abs(x2 - x);
  const height = Math.abs(y2 - y);

  // Tab definitions
  const tabs = [
    { id: 'general' as const, label: 'General', icon: '📄' },
    { id: 'style' as const, label: 'Style', icon: '🎨' },
    { id: 'text' as const, label: 'Text', icon: '📝' },
    { id: 'arrange' as const, label: 'Arrange', icon: '📐' }
  ];

  return (
    <div className="w-full h-full bg-white border-l border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Element Properties</h2>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-sm">
          {activeTab === 'general' && (
            <div className="space-y-4">
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
            </div>
          )}
          
          {activeTab === 'style' && (
            <div className="space-y-4">
              {element.type === "custom" && element.shape && !element.styles && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
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
                    <input
                      type="color"
                      value={element.styles?.fill || "#3b82f6"}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            fill: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      {element.styles?.fill ? "Custom override" : "Using original colors"}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Color:</label>
                    <input
                      type="color"
                      value={element.styles?.stroke || "#1e293b"}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const updatedElement = { 
                          ...element, 
                          styles: { 
                            ...element.styles, 
                            stroke: newValue 
                          }
                        };
                        updateElement(updatedElement);
                      }}
                      className="w-full h-8 border border-slate-300 rounded cursor-pointer"
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      {element.styles?.stroke ? "Custom override" : "Using original colors"}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stroke Width:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={element.styles?.strokeWidth || 1}
                    onChange={(e) => {
                      const newValue = Number(e.target.value);
                      const updatedElement = { 
                        ...element, 
                        styles: { 
                          ...element.styles, 
                          strokeWidth: newValue 
                        }
                      };
                      updateElement(updatedElement);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'text' && (
            <div className="space-y-4">
              {(() => {
                // Collect all text regions from shapeElements
                const allTextRegions: Array<{
                  id: string;
                  text: string;
                  x: number;
                  y: number;
                  shapeElementId: string;
                  regionIndex: number;
                }> = [];
                
                if (element.shapeElements) {
                  element.shapeElements.forEach((shapeElement: any) => {
                    if (shapeElement.textRegions) {
                      shapeElement.textRegions.forEach((region: any, regionIndex: number) => {
                        allTextRegions.push({
                          id: `${shapeElement.id}-${regionIndex}`,
                          text: region.text || '',
                          x: region.x || 0,
                          y: region.y || 0,
                          shapeElementId: shapeElement.id,
                          regionIndex: regionIndex
                        });
                      });
                    }
                  });
                }

                if (allTextRegions.length > 0) {
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Text Regions</span>
                        <div className="text-xs text-slate-500">{allTextRegions.length} region(s)</div>
                      </div>
                      
                      {allTextRegions.map((region, index) => (
                        <div key={region.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">Text Region {index + 1}</span>
                            <div className="text-xs text-slate-500">Shape: {region.shapeElementId}</div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Text:</label>
                              <textarea
                                value={region.text}
                                onChange={(e) => {
                                  const updatedElement = { ...element };
                                  if (updatedElement.shapeElements) {
                                    updatedElement.shapeElements = updatedElement.shapeElements.map((shapeEl: any) => {
                                      if (shapeEl.id === region.shapeElementId) {
                                        const updatedShapeEl = { ...shapeEl };
                                        if (updatedShapeEl.textRegions) {
                                          updatedShapeEl.textRegions = [...updatedShapeEl.textRegions];
                                          updatedShapeEl.textRegions[region.regionIndex] = {
                                            ...updatedShapeEl.textRegions[region.regionIndex],
                                            text: e.target.value
                                          };
                                        }
                                        return updatedShapeEl;
                                      }
                                      return shapeEl;
                                    });
                                  }
                                  updateElement(updatedElement);
                                }}
                                rows={3}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                placeholder="Enter text..."
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">X Position:</label>
                                <input
                                  type="number"
                                  value={Math.round(region.x)}
                                  onChange={(e) => {
                                    const updatedElement = { ...element };
                                    if (updatedElement.shapeElements) {
                                      updatedElement.shapeElements = updatedElement.shapeElements.map((shapeEl: any) => {
                                        if (shapeEl.id === region.shapeElementId) {
                                          const updatedShapeEl = { ...shapeEl };
                                          if (updatedShapeEl.textRegions) {
                                            updatedShapeEl.textRegions = [...updatedShapeEl.textRegions];
                                            updatedShapeEl.textRegions[region.regionIndex] = {
                                              ...updatedShapeEl.textRegions[region.regionIndex],
                                              x: Number(e.target.value)
                                            };
                                          }
                                          return updatedShapeEl;
                                        }
                                        return shapeEl;
                                      });
                                    }
                                    updateElement(updatedElement);
                                  }}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Y Position:</label>
                                <input
                                  type="number"
                                  value={Math.round(region.y)}
                                  onChange={(e) => {
                                    const updatedElement = { ...element };
                                    if (updatedElement.shapeElements) {
                                      updatedElement.shapeElements = updatedElement.shapeElements.map((shapeEl: any) => {
                                        if (shapeEl.id === region.shapeElementId) {
                                          const updatedShapeEl = { ...shapeEl };
                                          if (updatedShapeEl.textRegions) {
                                            updatedShapeEl.textRegions = [...updatedShapeEl.textRegions];
                                            updatedShapeEl.textRegions[region.regionIndex] = {
                                              ...updatedShapeEl.textRegions[region.regionIndex],
                                              y: Number(e.target.value)
                                            };
                                          }
                                          return updatedShapeEl;
                                        }
                                        return shapeEl;
                                      });
                                    }
                                    updateElement(updatedElement);
                                  }}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <div className="text-2xl mb-2">📝</div>
                      <div className="text-sm">No text regions found</div>
                      <div className="text-xs mt-1">This element has no editable text regions</div>
                      <div className="text-xs mt-1 text-slate-400">
                        Text regions are created when elements contain &lt;text&gt; SVG elements
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          )}
          
          {activeTab === 'arrange' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">X Position:</label>
                      <input
                        type="number"
                        value={x}
                        onChange={(e) => {
                          const newX = Number(e.target.value);
                          const updatedElement = { 
                            ...element, 
                            start: { ...element.start, x: newX },
                            end: { ...element.end, x: newX + width }
                          };
                          updateElement(updatedElement);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Y Position:</label>
                      <input
                        type="number"
                        value={y}
                        onChange={(e) => {
                          const newY = Number(e.target.value);
                          const updatedElement = { 
                            ...element, 
                            start: { ...element.start, y: newY },
                            end: { ...element.end, y: newY + height }
                          };
                          updateElement(updatedElement);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Width:</label>
                      <input
                        type="number"
                        min="10"
                        value={width}
                        onChange={(e) => {
                          const newWidth = Number(e.target.value);
                          const updatedElement = { 
                            ...element, 
                            end: { ...element.end, x: x + newWidth }
                          };
                          updateElement(updatedElement);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Height:</label>
                      <input
                        type="number"
                        min="10"
                        value={height}
                        onChange={(e) => {
                          const newHeight = Number(e.target.value);
                          const updatedElement = { 
                            ...element, 
                            end: { ...element.end, y: y + newHeight }
                          };
                          updateElement(updatedElement);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const centerX = (x + x2) / 2;
                      const centerY = (y + y2) / 2;
                      const halfWidth = width / 2;
                      const halfHeight = height / 2;
                      const updatedElement = { 
                        ...element,
                        start: { x: centerX - halfWidth, y: centerY - halfHeight },
                        end: { x: centerX + halfWidth, y: centerY + halfHeight }
                      };
                      updateElement(updatedElement);
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => {
                      const updatedElement = { 
                        ...element,
                        start: { x: 0, y: 0 },
                        end: { x: width, y: height }
                      };
                      updateElement(updatedElement);
                    }}
                    className="px-3 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors text-xs"
                  >
                    Reset Position
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;