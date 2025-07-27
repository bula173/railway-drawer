/**
 * @file PropertiesPanel.tsx
 * @brief Enhanced properties panel component with improved validation and error handling
 * 
 * This is an improved version of the PropertiesPanel with better:
 * - Error handling and validation
 * - Type safety
 * - Performance optimizations
 * - Accessibility
 * - Documentation
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { logger, logError } from '../utils/logger';
import { debounce, isDefined, removeUndefined } from '../utils';
import type { 
  DrawElement, 
  PropertiesTabType, 
  PropertiesPanelProps,
  TextRegion 
} from '../types';

// Default style values - should match the actual defaults used when creating elements
const DEFAULT_STYLES = {
  fill: '#3b82f6',        // blue-500 (matches DrawArea.tsx)
  stroke: '#1e293b',      // slate-800 (matches DrawArea.tsx)
  strokeWidth: 2,         // matches DrawArea.tsx
  opacity: 1,
} as const;

// Enhanced interface with better validation
interface EnhancedPropertiesPanelProps extends PropertiesPanelProps {
  maxNameLength?: number;
  validateElementName?: (name: string) => boolean;
  onValidationError?: (error: string) => void;
}

/**
 * Enhanced PropertiesPanel component with improved validation and error handling
 */
const EnhancedPropertiesPanel: React.FC<EnhancedPropertiesPanelProps> = ({ 
  drawAreaRef,
  selectedElement, 
  onElementChange,
  maxNameLength = 100,
  validateElementName = (name: string) => name.length <= maxNameLength,
  onValidationError,
  className = '',
  'data-testid': testId = 'properties-panel'
}) => {
  const [activeTab, setActiveTab] = useState<PropertiesTabType>('general');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Debounced element update to improve performance
  const debouncedUpdateElement = useMemo(
    () => debounce((updatedElement: DrawElement) => {
      try {
        if (!drawAreaRef?.current) {
          throw new Error('DrawArea reference not available');
        }

        const currentElements = drawAreaRef.current.getElements();
        const updatedElements = currentElements.map(el => 
          el.id === updatedElement.id ? updatedElement : el
        );
        
        drawAreaRef.current.setElements(updatedElements);
        onElementChange?.(updatedElement);
        
        logger.debug('properties', 'Element updated successfully', {
          elementId: updatedElement.id,
          totalElements: updatedElements.length
        });
      } catch (error) {
        logError('properties', 'Failed to update element', error);
        onValidationError?.('Failed to update element. Please try again.');
      }
    }, 300),
    [drawAreaRef, onElementChange, onValidationError]
  );

  // Validate and update element with error handling
  const updateElement = useCallback((updatedElement: DrawElement) => {
    // Clear previous validation errors
    setValidationErrors({});

    // Validate element name
    if (!validateElementName(updatedElement.name || '')) {
      const error = `Element name must not exceed ${maxNameLength} characters`;
      setValidationErrors(prev => ({ ...prev, name: error }));
      onValidationError?.(error);
      return;
    }

    // Validate element properties
    const errors: Record<string, string> = {};
    
    if ((updatedElement.width || 0) <= 0) {
      errors.width = 'Width must be greater than 0';
    }
    
    if ((updatedElement.height || 0) <= 0) {
      errors.height = 'Height must be greater than 0';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      onValidationError?.(Object.values(errors)[0]);
      return;
    }

    debouncedUpdateElement(updatedElement);
  }, [validateElementName, maxNameLength, onValidationError, debouncedUpdateElement]);

  // Collect text regions from shapeElements with better error handling
  const collectTextRegions = useCallback((element: DrawElement): TextRegion[] => {
    try {
      if (!element.shapeElements || !Array.isArray(element.shapeElements)) {
        return [];
      }

      const allTextRegions: TextRegion[] = [];
      
      element.shapeElements.forEach((shapeEl, shapeIndex) => {
        if (shapeEl.textRegions && Array.isArray(shapeEl.textRegions)) {
          shapeEl.textRegions.forEach((region: any, regionIndex: number) => {
            if (isDefined(region.text)) {
              allTextRegions.push({
                id: region.id || `text-${shapeIndex}-${regionIndex}`,
                text: region.text,
                x: region.x || 0,
                y: region.y || 0,
                width: region.width || 100,
                height: region.height || 20,
                fontSize: region.fontSize || 12,
                fontFamily: region.fontFamily || 'Arial',
                fill: region.fill || '#000000',
                textAnchor: region.textAnchor || 'start',
                dominantBaseline: region.dominantBaseline || 'auto',
              });
            }
          });
        }
      });

      return allTextRegions;
    } catch (error) {
      logError('properties', 'Failed to collect text regions', error);
      return [];
    }
  }, []);

  // Get canvas properties with error handling
  const getCanvasProperties = useCallback(() => {
    try {
      if (!drawAreaRef?.current) {
        return { backgroundColor: '#ffffff', gridVisible: true };
      }

      return {
        backgroundColor: drawAreaRef.current.getBackgroundColor?.() || '#ffffff',
        gridVisible: drawAreaRef.current.getGridVisible?.() || true,
      };
    } catch (error) {
      logError('properties', 'Failed to get canvas properties', error);
      return { backgroundColor: '#ffffff', gridVisible: true };
    }
  }, [drawAreaRef]);

  // Handle text region updates
  const updateTextRegion = useCallback((regionId: string, updates: Partial<TextRegion>) => {
    if (!selectedElement) return;

    try {
      const updatedElement = { ...selectedElement };
      
      if (updatedElement.shapeElements) {
        updatedElement.shapeElements = updatedElement.shapeElements.map(shapeEl => {
          if (shapeEl.textRegions) {
            return {
              ...shapeEl,
              textRegions: shapeEl.textRegions.map((region: any) =>
                region.id === regionId ? { ...region, ...removeUndefined(updates) } : region
              ),
            };
          }
          return shapeEl;
        });
      }

      updateElement(updatedElement);
    } catch (error) {
      logError('properties', 'Failed to update text region', error);
      onValidationError?.('Failed to update text region. Please try again.');
    }
  }, [selectedElement, updateElement, onValidationError]);

  // Handle style updates with validation
  const updateElementStyles = useCallback((styleUpdates: Record<string, any>) => {
    if (!selectedElement) return;

    try {
      const validatedStyles = removeUndefined(styleUpdates);
      
      const updatedElement = {
        ...selectedElement,
        styles: {
          ...selectedElement.styles,
          ...validatedStyles,
        },
      };

      updateElement(updatedElement);
    } catch (error) {
      logError('properties', 'Failed to update element styles', error);
      onValidationError?.('Failed to update styles. Please try again.');
    }
  }, [selectedElement, updateElement, onValidationError]);

  // Reset styles to original toolbox styles (removes all style overrides)
  const resetStylesToDefault = useCallback(() => {
    if (!selectedElement) return;

    try {
      const updatedElement = {
        ...selectedElement,
        styles: undefined, // Remove all style overrides to return to original toolbox styles
      };

      updateElement(updatedElement);
      logger.debug('properties', 'Styles reset to original toolbox styles', {
        elementId: updatedElement.id,
        resetAction: 'removed_all_style_overrides'
      });
    } catch (error) {
      logError('properties', 'Failed to reset styles to original', error);
      onValidationError?.('Failed to reset styles. Please try again.');
    }
  }, [selectedElement, updateElement, onValidationError]);

  // Memoized text regions for performance
  const textRegions = useMemo(() => {
    return selectedElement ? collectTextRegions(selectedElement) : [];
  }, [selectedElement, collectTextRegions]);

  // Canvas properties (when no element is selected)
  if (!selectedElement) {
    const canvasProps = getCanvasProperties();
    
    return (
      <div className={`w-full h-full bg-white border-l border-slate-200 flex flex-col ${className}`} data-testid={testId}>
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Canvas Properties</h2>
        </div>
        
        <div className="flex-1 p-4 overflow-auto">
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Background Color:
                  </label>
                  <input
                    type="color"
                    defaultValue={canvasProps.backgroundColor}
                    onChange={(e) => {
                      try {
                        drawAreaRef?.current?.setBackgroundColor?.(e.target.value);
                      } catch (error) {
                        logError('properties', 'Failed to update background color', error);
                      }
                    }}
                    className="w-16 h-8 rounded border border-slate-300 cursor-pointer"
                    aria-label="Canvas background color"
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      defaultChecked={canvasProps.gridVisible}
                      onChange={(e) => {
                        try {
                          drawAreaRef?.current?.setGridVisible?.(e.target.checked);
                        } catch (error) {
                          logError('properties', 'Failed to update grid visibility', error);
                        }
                      }}
                      className="rounded border-slate-300"
                      aria-label="Grid visibility"
                    />
                    <span className="text-sm font-medium text-slate-700">Grid Visible</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Element properties with tabbed interface
  return (
    <div className={`w-full h-full bg-white border-l border-slate-200 flex flex-col ${className}`} data-testid={testId}>
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Element Properties</h2>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-1" role="tablist">
          {(['general', 'style', 'text', 'arrange'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto" role="tabpanel" id={`${activeTab}-panel`}>
        {/* Show validation errors */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800">
              {Object.values(validationErrors).map((error, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-700">ID:</span>
                <span className="ml-2 text-slate-600 font-mono">{selectedElement.id}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Type:</span>
                <span className="ml-2 text-slate-600">{selectedElement.type}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Position:</span>
                <span className="ml-2 text-slate-600">
                  ({Math.round(selectedElement.start.x)}, {Math.round(selectedElement.start.y)})
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Size:</span>
                <span className="ml-2 text-slate-600">
                  {Math.round(selectedElement.width || 0)} × {Math.round(selectedElement.height || 0)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name:
              </label>
              <input
                type="text"
                value={selectedElement.name}
                onChange={(e) => {
                  const updatedElement = { ...selectedElement, name: e.target.value };
                  updateElement(updatedElement);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.name ? 'border-red-300' : 'border-slate-300'
                }`}
                maxLength={maxNameLength}
                aria-label="Element name"
                aria-invalid={!!validationErrors.name}
                aria-describedby={validationErrors.name ? 'name-error' : undefined}
              />
              {validationErrors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fill Color:
                </label>
                <input
                  type="color"
                  value={selectedElement.styles?.fill || DEFAULT_STYLES.fill}
                  onChange={(e) => updateElementStyles({ fill: e.target.value })}
                  className="w-full h-10 rounded border border-slate-300 cursor-pointer"
                  aria-label="Fill color"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stroke Color:
                </label>
                <input
                  type="color"
                  value={selectedElement.styles?.stroke || DEFAULT_STYLES.stroke}
                  onChange={(e) => updateElementStyles({ stroke: e.target.value })}
                  className="w-full h-10 rounded border border-slate-300 cursor-pointer"
                  aria-label="Stroke color"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stroke Width:
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={selectedElement.styles?.strokeWidth || DEFAULT_STYLES.strokeWidth}
                  onChange={(e) => updateElementStyles({ strokeWidth: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Stroke width"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Opacity:
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedElement.styles?.opacity || DEFAULT_STYLES.opacity}
                  onChange={(e) => updateElementStyles({ opacity: parseFloat(e.target.value) })}
                  className="w-full"
                  aria-label="Opacity"
                />
                <div className="text-xs text-slate-500 text-center">
                  {Math.round((selectedElement.styles?.opacity || DEFAULT_STYLES.opacity) * 100)}%
                </div>
              </div>
            </div>
            
            {/* Reset Styles Button */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={resetStylesToDefault}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Reset styles to original toolbox configuration"
              >
                Reset to Original Toolbox Style
              </button>
            </div>
          </div>
        )}

        {/* Text Tab */}
        {activeTab === 'text' && (
          <div className="p-4">
            {textRegions.length > 0 ? (
              <div className="space-y-4">
                {textRegions.map((region) => (
                  <div key={region.id} className="p-3 border border-slate-200 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Text:
                        </label>
                        <textarea
                          value={region.text}
                          onChange={(e) => updateTextRegion(region.id, { text: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          aria-label={`Text for region ${region.id}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Font Size:
                          </label>
                          <input
                            type="number"
                            min="8"
                            max="72"
                            value={region.fontSize}
                            onChange={(e) => updateTextRegion(region.id, { fontSize: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            aria-label={`Font size for region ${region.id}`}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Color:
                          </label>
                          <input
                            type="color"
                            value={region.fill}
                            onChange={(e) => updateTextRegion(region.id, { fill: e.target.value })}
                            className="w-full h-10 rounded border border-slate-300 cursor-pointer"
                            aria-label={`Text color for region ${region.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No text regions found</p>
                <p className="text-sm mt-1">This element doesn't contain editable text</p>
              </div>
            )}
          </div>
        )}

        {/* Arrange Tab */}
        {activeTab === 'arrange' && (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Position & Size</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">X:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.start.x)}
                    onChange={(e) => {
                      const newX = parseInt(e.target.value);
                      const updatedElement = {
                        ...selectedElement,
                        start: { ...selectedElement.start, x: newX },
                        end: { ...selectedElement.end, x: newX + (selectedElement.width || 0) },
                      };
                      updateElement(updatedElement);
                    }}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                    aria-label="X position"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Y:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.start.y)}
                    onChange={(e) => {
                      const newY = parseInt(e.target.value);
                      const updatedElement = {
                        ...selectedElement,
                        start: { ...selectedElement.start, y: newY },
                        end: { ...selectedElement.end, y: newY + (selectedElement.height || 0) },
                      };
                      updateElement(updatedElement);
                    }}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                    aria-label="Y position"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Width:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={Math.round(selectedElement.width || 0)}
                    onChange={(e) => {
                      const newWidth = parseInt(e.target.value);
                      const updatedElement = {
                        ...selectedElement,
                        width: newWidth,
                        end: { ...selectedElement.end, x: selectedElement.start.x + newWidth },
                      };
                      updateElement(updatedElement);
                    }}
                    className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                      validationErrors.width ? 'border-red-300' : 'border-slate-300'
                    }`}
                    aria-label="Width"
                    aria-invalid={!!validationErrors.width}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Height:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={Math.round(selectedElement.height || 0)}
                    onChange={(e) => {
                      const newHeight = parseInt(e.target.value);
                      const updatedElement = {
                        ...selectedElement,
                        height: newHeight,
                        end: { ...selectedElement.end, y: selectedElement.start.y + newHeight },
                      };
                      updateElement(updatedElement);
                    }}
                    className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                      validationErrors.height ? 'border-red-300' : 'border-slate-300'
                    }`}
                    aria-label="Height"
                    aria-invalid={!!validationErrors.height}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Transform</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Rotation:
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedElement.rotation || 0}
                  onChange={(e) => {
                    const updatedElement = {
                      ...selectedElement,
                      rotation: parseInt(e.target.value),
                    };
                    updateElement(updatedElement);
                  }}
                  className="w-full"
                  aria-label="Rotation"
                />
                <div className="text-xs text-slate-500 text-center">
                  {selectedElement.rotation || 0}°
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedPropertiesPanel;
