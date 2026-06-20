/**
 * @file ConnectorPanel.tsx
 * @brief Panel for styling and configuring connectors
 */

import React from 'react';
import {
  ConnectorStyle,
  ConnectorArrowStyle,
  ConnectorLineStyle,
  ConnectorLineWidth,
  ARROW_STYLES,
  LINE_STYLES,
  LINE_WIDTHS,
} from '../utils/connectorStyles';
import { ChevronDown } from 'lucide-react';

interface ConnectorPanelProps {
  style: ConnectorStyle;
  onStyleChange: (style: ConnectorStyle) => void;
  onClose?: () => void;
}

export const ConnectorPanel: React.FC<ConnectorPanelProps> = ({
  style,
  onStyleChange,
  onClose,
}) => {
  const handleLineStyleChange = (lineStyle: ConnectorLineStyle) => {
    onStyleChange({ ...style, lineStyle });
  };

  const handleLineWidthChange = (lineWidth: ConnectorLineWidth) => {
    onStyleChange({ ...style, lineWidth });
  };

  const handleStartArrowChange = (startArrow: ConnectorArrowStyle) => {
    onStyleChange({ ...style, startArrow });
  };

  const handleEndArrowChange = (endArrow: ConnectorArrowStyle) => {
    onStyleChange({ ...style, endArrow });
  };

  const handleColorChange = (color: string) => {
    onStyleChange({ ...style, color });
  };

  const handleOpacityChange = (opacity: number) => {
    onStyleChange({ ...style, opacity });
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '280px',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        borderLeft: '1px solid #ddd',
        padding: '16px',
        overflowY: 'auto',
        zIndex: 1000,
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
          Connector Style
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

      {/* Line Style */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Line Style
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.entries(LINE_STYLES).map(([styleKey, styleLabel]) => (
            <button
              key={styleKey}
              onClick={() => handleLineStyleChange(styleKey as ConnectorLineStyle)}
              style={{
                flex: 1,
                padding: '6px',
                border: style.lineStyle === styleKey ? '2px solid #007bff' : '1px solid #ccc',
                borderRadius: '4px',
                background: style.lineStyle === styleKey ? '#e7f3ff' : 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              {styleLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Line Width */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Line Width: {style.lineWidth}px
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LINE_WIDTHS.map((width) => (
            <button
              key={width}
              onClick={() => handleLineWidthChange(width)}
              style={{
                flex: 1,
                padding: '6px',
                border: style.lineWidth === width ? '2px solid #007bff' : '1px solid #ccc',
                borderRadius: '4px',
                background: style.lineWidth === width ? '#e7f3ff' : 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              {width}
            </button>
          ))}
        </div>
      </div>

      {/* Start Arrow */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Start Arrow
        </label>
        <select
          value={style.startArrow}
          onChange={(e) => handleStartArrowChange(e.target.value as ConnectorArrowStyle)}
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {Object.entries(ARROW_STYLES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* End Arrow */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          End Arrow
        </label>
        <select
          value={style.endArrow}
          onChange={(e) => handleEndArrowChange(e.target.value as ConnectorArrowStyle)}
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {Object.entries(ARROW_STYLES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Color
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={style.color}
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
            value={style.color}
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
          Opacity: {Math.round(style.opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={style.opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
};
