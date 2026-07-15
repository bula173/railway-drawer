/**
 * @file DrawioPropertiesPanel.tsx
 * @brief Draw.io-inspired properties panel with clean, organized interface
 *
 * Features:
 * - Tab-based organization (Style, Text, Arrange)
 * - Collapsible sections (Fill, Stroke, Size, etc.)
 * - Clean color pickers
 * - Professional styling
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DrawElement } from './Elements';
import type { ConnectorStyle } from '../utils/connectorStyles';
import type { BrushConfig } from '../utils/brushTools';
import { logger } from '../utils/logger';
import { ConnectorPanel } from './ConnectorPanel';
import { BrushPanel } from './BrushPanel';

interface DrawioPropertiesPanelProps {
  drawAreaRef: any;
  selectedElement?: DrawElement;
  selectedConnectorId?: string;
  selectedConnectorStyle?: ConnectorStyle;
  brushMode?: boolean;
  brushConfig?: BrushConfig;
  onElementChange?: (element: DrawElement) => void;
  onConnectorStyleChange?: (style: ConnectorStyle) => void;
  onBrushConfigChange?: (config: BrushConfig) => void;
  onCanvasPropertyChange?: (property: string, value: any) => void;
}

type TabType = 'style' | 'text' | 'arrange';

const DrawioPropertiesPanel: React.FC<DrawioPropertiesPanelProps> = ({
  drawAreaRef,
  selectedElement,
  selectedConnectorId,
  selectedConnectorStyle,
  brushMode,
  brushConfig,
  onElementChange,
  onConnectorStyleChange,
  onBrushConfigChange,
  onCanvasPropertyChange,
}) => {
  // Check if selected element is a connector (type === 'connector')
  const isConnectorElement = selectedElement && selectedElement.type === 'connector';
  const isElementBrush = selectedElement && selectedElement.type === 'brush';
  const [activeTab, setActiveTab] = useState<TabType>('style');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fill: true,
    stroke: true,
    size: true,
    spacing: false,
    opacity: false,
    effects: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const updateElementProperty = useCallback((updates: Partial<DrawElement>) => {
    if (!selectedElement) return;
    const updatedElement = {
      ...selectedElement,
      ...updates,
      styles: {
        ...selectedElement.styles,
        ...(updates.styles || {}),
      },
    };
    logger.debug('DrawioPropertiesPanel', 'Element property updated', {
      elementId: updatedElement.id,
      updates,
    });
    onElementChange?.(updatedElement);
  }, [selectedElement, onElementChange]);

  // Show canvas properties when no element is selected
  if (!selectedElement) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {(['style', 'text', 'arrange'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-slate-900 border-b-2 border-blue-500 bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Canvas Properties */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'style' && (
            <div className="space-y-1">
              <CollapsibleSection
                title="Canvas"
                expanded={expandedSections.fill}
                onToggle={() => toggleSection('fill')}
              >
                <div className="space-y-2 p-2">
                  <div>
                    <label className="text-xs text-slate-600">Background</label>
                    <input
                      type="color"
                      defaultValue="#ffffff"
                      onChange={(e) => {
                        onCanvasPropertyChange?.('backgroundColor', e.target.value);
                        drawAreaRef?.current?.setBackgroundColor(e.target.value);
                      }}
                      className="w-full h-8 border border-slate-200 rounded cursor-pointer mt-1"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      onChange={(e) => {
                        onCanvasPropertyChange?.('gridVisible', e.target.checked);
                        drawAreaRef?.current?.setGridVisible(e.target.checked);
                      }}
                      className="w-3 h-3"
                    />
                    <span>Show Grid</span>
                  </label>
                  <div>
                    <label className="text-xs text-slate-600">Grid Size</label>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      defaultValue="20"
                      onChange={(e) => {
                        onCanvasPropertyChange?.('gridSize', parseInt(e.target.value));
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 mt-1"
                    />
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="text-xs text-slate-500 p-3">
              No element selected
            </div>
          )}

          {activeTab === 'arrange' && (
            <div className="text-xs text-slate-500 p-3">
              No element selected
            </div>
          )}
        </div>
      </div>
    );
  }

  // If brush mode is active or selected element is brush type, show brush properties
  if ((brushMode && brushConfig && onBrushConfigChange) || (isElementBrush && brushConfig && onBrushConfigChange)) {
    return (
      <div style={{ height: '100%', backgroundColor: '#f5f5f5', overflow: 'auto' }}>
        <BrushPanel
          config={brushConfig}
          onConfigChange={onBrushConfigChange}
          onClose={() => {/* handled by parent */}}
        />
      </div>
    );
  }

  // If a connector element is selected, show connector properties
  if (isConnectorElement && onElementChange) {
    const connectorStyle = selectedElement?.connectorStyle || {
      lineStyle: 'solid' as const,
      lineWidth: 2 as const,
      startArrow: 'none' as const,
      endArrow: 'standard' as const,
      color: '#333333',
      opacity: 1,
    };
    return (
      <div style={{ height: '100%', backgroundColor: '#f5f5f5', overflow: 'auto' }}>
        <ConnectorPanel
          style={connectorStyle}
          label={selectedElement?.name || ''}
          fromAttached={selectedElement?.fromAttached !== false}
          toAttached={selectedElement?.toAttached !== false}
          onStyleChange={(newStyle) => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                connectorStyle: newStyle
              });
            }
          }}
          onLabelChange={(newLabel) => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                name: newLabel
              });
            }
          }}
          onDetachStart={() => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                fromAttached: false
              });
            }
          }}
          onDetachEnd={() => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                toAttached: false
              });
            }
          }}
          onAttachStart={() => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                fromAttached: true
              });
            }
          }}
          onAttachEnd={() => {
            if (selectedElement) {
              onElementChange({
                ...selectedElement,
                toAttached: true
              });
            }
          }}
          onDelete={() => {
            if (selectedElement) {
              // Signal to parent to delete this connector
              const deleteEvent = new CustomEvent('deleteConnector', { detail: { connectorId: selectedElement.id } });
              window.dispatchEvent(deleteEvent);
            }
          }}
          onClose={() => {/* handled by parent */}}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {(['style', 'text', 'arrange'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'text-slate-900 border-b-2 border-blue-500 bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'style' && (
          <div className="p-3 space-y-1">
            {/* Fill Section */}
            <CollapsibleSection
              title="Fill"
              expanded={expandedSections.fill}
              onToggle={() => toggleSection('fill')}
            >
              <div className="space-y-2 p-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-3 h-3"
                  />
                  <span>Fill</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    defaultValue="#3b82f6"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          fill: e.target.value,
                        },
                      })
                    }
                    className="w-8 h-8 border border-slate-200 rounded cursor-pointer"
                  />
                  <span className="text-xs text-slate-600">Color</span>
                  <select className="text-xs border border-slate-200 rounded px-2 py-1 ml-auto">
                    <option>Auto</option>
                    <option>Solid</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            {/* Stroke Section */}
            <CollapsibleSection
              title="Line"
              expanded={expandedSections.stroke}
              onToggle={() => toggleSection('stroke')}
            >
              <div className="space-y-2 p-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-3 h-3"
                  />
                  <span>Line</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    defaultValue="#1e293b"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          stroke: e.target.value,
                        },
                      })
                    }
                    className="w-8 h-8 border border-slate-200 rounded cursor-pointer"
                  />
                  <span className="text-xs text-slate-600">Color</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="2"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          strokeWidth: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-12 text-xs border border-slate-200 rounded px-2 py-1"
                  />
                  <span className="text-xs text-slate-600">pt</span>
                </div>
              </div>
            </CollapsibleSection>

            {/* Size Section */}
            <CollapsibleSection
              title="Size"
              expanded={expandedSections.size}
              onToggle={() => toggleSection('size')}
            >
              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Width</label>
                    <input
                      type="number"
                      value={Math.abs(selectedElement.end.x - selectedElement.start.x)}
                      onChange={(e) => {
                        const width = parseInt(e.target.value);
                        const midX = (selectedElement.start.x + selectedElement.end.x) / 2;
                        updateElementProperty({
                          start: { ...selectedElement.start, x: midX - width / 2 },
                          end: { ...selectedElement.end, x: midX + width / 2 },
                        });
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Height</label>
                    <input
                      type="number"
                      value={Math.abs(selectedElement.end.y - selectedElement.start.y)}
                      onChange={(e) => {
                        const height = parseInt(e.target.value);
                        const midY = (selectedElement.start.y + selectedElement.end.y) / 2;
                        updateElementProperty({
                          start: { ...selectedElement.start, y: midY - height / 2 },
                          end: { ...selectedElement.end, y: midY + height / 2 },
                        });
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Spacing Section */}
            <CollapsibleSection
              title="Spacing"
              expanded={expandedSections.spacing}
              onToggle={() => toggleSection('spacing')}
            >
              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">X</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.start.x)}
                      onChange={(e) =>
                        updateElementProperty({
                          start: { ...selectedElement.start, x: parseInt(e.target.value) },
                          end: {
                            ...selectedElement.end,
                            x: parseInt(e.target.value) + (selectedElement.end.x - selectedElement.start.x),
                          },
                        })
                      }
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Y</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.start.y)}
                      onChange={(e) =>
                        updateElementProperty({
                          start: { ...selectedElement.start, y: parseInt(e.target.value) },
                          end: {
                            ...selectedElement.end,
                            y: parseInt(e.target.value) + (selectedElement.end.y - selectedElement.start.y),
                          },
                        })
                      }
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Opacity Section */}
            <CollapsibleSection
              title="Opacity"
              expanded={expandedSections.opacity}
              onToggle={() => toggleSection('opacity')}
            >
              <div className="space-y-2 p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="100"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          opacity: parseInt(e.target.value) / 100,
                        },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-slate-600 w-12 text-right">100%</span>
                </div>
              </div>
            </CollapsibleSection>

            {/* Effects Section */}
            <CollapsibleSection
              title="Effects"
              expanded={expandedSections.effects}
              onToggle={() => toggleSection('effects')}
            >
              <div className="p-2 text-xs text-slate-500">
                No effects available
              </div>
            </CollapsibleSection>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="p-3 space-y-1">
            {/* Font Properties */}
            <CollapsibleSection
              title="Font"
              expanded={expandedSections.stroke}
              onToggle={() => toggleSection('stroke')}
            >
              <div className="space-y-2 p-2">
                <div>
                  <label className="text-xs text-slate-600">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    defaultValue="12"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          fontSize: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 mt-1"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    title="Bold"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100 font-bold"
                  >
                    B
                  </button>
                  <button
                    title="Italic"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100 italic"
                  >
                    I
                  </button>
                  <button
                    title="Underline"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100 underline"
                  >
                    U
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Color</label>
                  <input
                    type="color"
                    defaultValue="#000000"
                    onChange={(e) =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          color: e.target.value,
                        },
                      })
                    }
                    className="w-full h-8 border border-slate-200 rounded cursor-pointer mt-1"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Text Alignment */}
            <CollapsibleSection
              title="Alignment"
              expanded={expandedSections.size}
              onToggle={() => toggleSection('size')}
            >
              <div className="space-y-2 p-2">
                <div className="flex gap-1">
                  <button
                    title="Align Left"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100"
                    onClick={() =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          textAnchor: 'start',
                        },
                      })
                    }
                  >
                    ←
                  </button>
                  <button
                    title="Align Center"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100"
                    onClick={() =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          textAnchor: 'middle',
                        },
                      })
                    }
                  >
                    ↔
                  </button>
                  <button
                    title="Align Right"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-100"
                    onClick={() =>
                      updateElementProperty({
                        styles: {
                          ...selectedElement.styles,
                          textAnchor: 'end',
                        },
                      })
                    }
                  >
                    →
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Vertical</label>
                  <select className="w-full text-xs border border-slate-200 rounded px-2 py-1 mt-1">
                    <option>Top</option>
                    <option>Middle</option>
                    <option>Bottom</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        )}

        {activeTab === 'arrange' && (
          <div className="p-3">
            <div className="space-y-3 text-xs text-slate-500">
              <div>Layer ordering and alignment options coming soon</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Collapsible section component
 */
const CollapsibleSection: React.FC<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, expanded, onToggle, children }) => (
  <div className="border border-slate-200 rounded">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
    >
      <span className="text-xs font-semibold text-slate-700">{title}</span>
      <ChevronDown
        size={14}
        className={`text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
      />
    </button>
    {expanded && <div className="border-t border-slate-200">{children}</div>}
  </div>
);

export default DrawioPropertiesPanel;
