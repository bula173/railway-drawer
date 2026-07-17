/**
 * @file MaxGraphPropertiesPanel.tsx
 * @brief Properties panel for maxGraph cell editing
 *
 * Mirrors DrawioPropertiesPanel but works with maxGraph cells
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Cell, Graph } from '@maxgraph/core';
import { logger } from '../utils/logger';
import { parseStyle, updateCellStyle } from '../components/MaxGraphAdapter';
import './styles/maxGraphPropertiesPanel.css';

export interface MaxGraphPropertiesPanelProps {
  graph?: Graph;
  selectedCell?: Cell;
  onStyleChange?: (cell: Cell, style: string) => void;
}

export const MaxGraphPropertiesPanel: React.FC<MaxGraphPropertiesPanelProps> = ({
  graph,
  selectedCell,
  onStyleChange,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'style' | 'arrange'>('general');
  const [cellName, setCellName] = useState('');
  const [cellId, setCellId] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 80, height: 60 });
  const [rotation, setRotation] = useState(0);
  const [fillColor, setFillColor] = useState('#f0f0f0');
  const [strokeColor, setStrokeColor] = useState('#999999');
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [opacity, setOpacity] = useState(100);

  // Update state when selection changes
  useEffect(() => {
    if (!selectedCell) {
      resetState();
      return;
    }

    setCellName(selectedCell.getValue?.() || '');
    setCellId(selectedCell.getId() || '');

    const geo = selectedCell.getGeometry();
    if (geo) {
      setPosition({ x: Math.round(geo.x), y: Math.round(geo.y) });
      setSize({ width: Math.round(geo.width), height: Math.round(geo.height) });
    }

    const style = parseStyle(selectedCell.getStyle() || '');
    setRotation(parseInt(style.rotation || '0') || 0);
    setFillColor(style.fillColor || '#f0f0f0');
    setStrokeColor(style.strokeColor || '#999999');
    setStrokeWidth(parseInt(style.strokeWidth || '1') || 1);
    setOpacity(parseInt(style.opacity || '100') || 100);
  }, [selectedCell]);

  const resetState = (): void => {
    setCellName('');
    setCellId('');
    setPosition({ x: 0, y: 0 });
    setSize({ width: 80, height: 60 });
    setRotation(0);
    setFillColor('#f0f0f0');
    setStrokeColor('#999999');
    setStrokeWidth(1);
    setOpacity(100);
  };

  const applyChange = useCallback(
    (updates: Record<string, any>) => {
      if (!selectedCell || !graph) return;

      const geo = selectedCell.getGeometry();
      if (geo && (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined)) {
        const newGeo = geo.clone();
        if (updates.x !== undefined) newGeo.x = updates.x;
        if (updates.y !== undefined) newGeo.y = updates.y;
        if (updates.width !== undefined) newGeo.width = updates.width;
        if (updates.height !== undefined) newGeo.height = updates.height;
        selectedCell.setGeometry(newGeo);
      }

      if (updates.name !== undefined) {
        selectedCell.setValue(updates.name);
      }

      const styleUpdates: Record<string, string> = {};
      if (updates.rotation !== undefined) styleUpdates.rotation = updates.rotation.toString();
      if (updates.fillColor !== undefined) styleUpdates.fillColor = updates.fillColor;
      if (updates.strokeColor !== undefined) styleUpdates.strokeColor = updates.strokeColor;
      if (updates.strokeWidth !== undefined) styleUpdates.strokeWidth = updates.strokeWidth.toString();
      if (updates.opacity !== undefined) styleUpdates.opacity = updates.opacity.toString();

      if (Object.keys(styleUpdates).length > 0) {
        const currentStyle = parseStyle(selectedCell.getStyle() || '');
        const mergedStyle = { ...currentStyle, ...styleUpdates };
        const styleStr = Object.entries(mergedStyle)
          .map(([k, v]) => `${k}=${v}`)
          .join(';');
        selectedCell.setStyle(styleStr);
        onStyleChange?.(selectedCell, styleStr);
      }

      logger.debug('MaxGraphPropertiesPanel', 'Applied changes', updates);
    },
    [selectedCell, graph, onStyleChange]
  );

  if (!selectedCell) {
    return (
      <div className="maxgraph-properties-panel empty">
        <p>No element selected</p>
      </div>
    );
  }

  return (
    <div className="maxgraph-properties-panel">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
        <button
          className={`tab ${activeTab === 'arrange' ? 'active' : ''}`}
          onClick={() => setActiveTab('arrange')}
        >
          Arrange
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'general' && (
          <div className="general-tab">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={cellName}
                onChange={(e) => {
                  setCellName(e.target.value);
                  applyChange({ name: e.target.value });
                }}
                placeholder="Element name"
              />
            </div>

            <div className="form-group">
              <label>ID</label>
              <input type="text" value={cellId} disabled placeholder="Auto-generated" />
            </div>

            <div className="form-group">
              <label>Type</label>
              <input type="text" value={selectedCell.isEdge() ? 'Connector' : 'Shape'} disabled />
            </div>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="style-tab">
            <div className="form-group">
              <label>Fill Color</label>
              <div className="color-input">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value);
                    applyChange({ fillColor: e.target.value });
                  }}
                />
                <input
                  type="text"
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value);
                    applyChange({ fillColor: e.target.value });
                  }}
                  placeholder="#f0f0f0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Stroke Color</label>
              <div className="color-input">
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => {
                    setStrokeColor(e.target.value);
                    applyChange({ strokeColor: e.target.value });
                  }}
                />
                <input
                  type="text"
                  value={strokeColor}
                  onChange={(e) => {
                    setStrokeColor(e.target.value);
                    applyChange({ strokeColor: e.target.value });
                  }}
                  placeholder="#999999"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Stroke Width</label>
              <input
                type="number"
                min="0"
                max="10"
                value={strokeWidth}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setStrokeWidth(val);
                  applyChange({ strokeWidth: val });
                }}
              />
            </div>

            <div className="form-group">
              <label>Opacity</label>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 100;
                  setOpacity(val);
                  applyChange({ opacity: val });
                }}
              />
              <span className="value">{opacity}%</span>
            </div>
          </div>
        )}

        {activeTab === 'arrange' && (
          <div className="arrange-tab">
            <div className="form-row">
              <div className="form-group">
                <label>X</label>
                <input
                  type="number"
                  value={position.x}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPosition((p) => ({ ...p, x: val }));
                    applyChange({ x: val });
                  }}
                />
              </div>
              <div className="form-group">
                <label>Y</label>
                <input
                  type="number"
                  value={position.y}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPosition((p) => ({ ...p, y: val }));
                    applyChange({ y: val });
                  }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Width</label>
                <input
                  type="number"
                  min="10"
                  value={size.width}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 80;
                    setSize((s) => ({ ...s, width: val }));
                    applyChange({ width: val });
                  }}
                />
              </div>
              <div className="form-group">
                <label>Height</label>
                <input
                  type="number"
                  min="10"
                  value={size.height}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 60;
                    setSize((s) => ({ ...s, height: val }));
                    applyChange({ height: val });
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Rotation</label>
              <input
                type="number"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setRotation(val);
                  applyChange({ rotation: val });
                }}
              />
              <span>°</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

MaxGraphPropertiesPanel.displayName = 'MaxGraphPropertiesPanel';
