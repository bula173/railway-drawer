/**
 * @file BrushPanel.tsx
 * @brief Panel for brush tool configuration and styling
 */

import React from 'react';
import type { BrushType, BrushConfig } from '../utils/brushTools';
import { BRUSH_PRESETS, BRUSH_DESCRIPTIONS } from '../utils/brushTools';

interface BrushPanelProps {
  config: BrushConfig;
  onConfigChange: (config: BrushConfig) => void;
  onClose?: () => void;
}

export const BrushPanel: React.FC<BrushPanelProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  const brushTypes: BrushType[] = ['freehand', 'pen', 'marker', 'pencil', 'annotation'];

  const handleBrushTypeChange = (type: BrushType) => {
    const preset = BRUSH_PRESETS[type];
    onConfigChange({
      ...preset,
      color: config.color,
    });
  };

  const handleSizeChange = (size: number) => {
    onConfigChange({ ...config, size });
  };

  const handleColorChange = (color: string) => {
    onConfigChange({ ...config, color });
  };

  const handleOpacityChange = (opacity: number) => {
    onConfigChange({ ...config, opacity });
  };

  const handleSmoothingChange = (smoothing: number) => {
    onConfigChange({ ...config, smoothing });
  };

  const handlePressureChange = (pressure: boolean) => {
    onConfigChange({ ...config, pressure });
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '280px',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        borderRight: '1px solid #ddd',
        padding: '16px',
        overflowY: 'auto',
        zIndex: 1000,
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
      }}
      role="dialog"
      aria-label="Brush tool configuration panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
          Brush Tool
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '18px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Brush Type Selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Brush Type
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {brushTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleBrushTypeChange(type)}
              title={BRUSH_DESCRIPTIONS[type]}
              style={{
                padding: '8px',
                border: config.type === type ? '2px solid #007bff' : '1px solid #ccc',
                borderRadius: '4px',
                background: config.type === type ? '#e7f3ff' : 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '10px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
          {BRUSH_DESCRIPTIONS[config.type]}
        </p>
      </div>

      {/* Brush Size */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Size: {config.size.toFixed(1)}px
        </label>
        <input
          type="range"
          min="0.5"
          max="20"
          step="0.5"
          value={config.size}
          onChange={(e) => handleSizeChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {[1, 2, 4, 8].map((size) => (
            <button
              key={size}
              onClick={() => handleSizeChange(size)}
              style={{
                flex: 1,
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                background: Math.abs(config.size - size) < 0.1 ? '#007bff' : 'white',
                color: Math.abs(config.size - size) < 0.1 ? 'white' : 'black',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Color
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={config.color}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{
              width: '40px',
              height: '40px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          />
          <input
            type="text"
            value={config.color}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{
              flex: 1,
              padding: '6px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          />
        </div>
      </div>

      {/* Opacity */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Opacity: {Math.round(config.opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Smoothing */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Smoothing: {Math.round(config.smoothing * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.smoothing}
          onChange={(e) => handleSmoothingChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Pressure Sensitivity */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.pressure}
            onChange={(e) => handlePressureChange(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Pressure Sensitivity
        </label>
      </div>

      {/* Temporary Mode (for annotations) */}
      {config.type === 'annotation' && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#856404',
          marginTop: '16px',
        }}>
          ⚠️ Annotation strokes are temporary and won't be saved.
        </div>
      )}

      {/* Preview */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Preview
        </label>
        <svg
          width="100%"
          height="80"
          style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
          }}
        >
          <line
            x1="10"
            y1="40"
            x2="250"
            y2="40"
            stroke={config.color}
            strokeWidth={config.size}
            opacity={config.opacity}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
