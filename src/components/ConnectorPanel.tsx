/**
 * @file ConnectorPanel.tsx
 * @brief Panel for styling and configuring connectors
 */

import React from 'react';
import type {
  ConnectorStyle,
  ConnectorArrowStyle,
  ConnectorLineStyle,
  ConnectorLineWidth,
} from '../utils/connectorStyles';
import { ARROW_STYLES, LINE_STYLES, LINE_WIDTHS } from '../utils/connectorStyles';
import { ChevronDown } from 'lucide-react';

interface ConnectorPanelProps {
  style: ConnectorStyle;
  label?: string;
  fromAttached?: boolean;
  toAttached?: boolean;
  onStyleChange: (style: ConnectorStyle) => void;
  onLabelChange?: (label: string) => void;
  onDetachStart?: () => void;
  onDetachEnd?: () => void;
  onAttachStart?: () => void;
  onAttachEnd?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export const ConnectorPanel: React.FC<ConnectorPanelProps> = ({
  style,
  label = '',
  fromAttached = true,
  toAttached = true,
  onStyleChange,
  onLabelChange,
  onDetachStart,
  onDetachEnd,
  onAttachStart,
  onAttachEnd,
  onDelete,
  onClose,
}) => {
  console.log('🎨 CONNECTOR PANEL RENDERED with style:', style);
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
        zIndex: 999,
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      }}
      role="dialog"
      aria-label="Connector styling panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
          Connector
        </h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete connector"
              style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                fontWeight: 'bold',
              }}
            >
              Delete
            </button>
          )}
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
      </div>

      {/* Label */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange?.(e.target.value)}
          placeholder="Add label text..."
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Attachment Controls */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          Attachment
        </label>

        {/* Start Attachment */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', flex: 1 }}>Start:</span>
            <span style={{ fontSize: '10px', color: '#666' }}>
              {fromAttached ? '✓ Attached' : '◯ Detached'}
            </span>
          </div>
          <button
            onClick={fromAttached ? onDetachStart : onAttachStart}
            style={{
              width: '100%',
              padding: '4px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              background: fromAttached ? '#e8f4f8' : '#fff8f0',
              color: '#333',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            {fromAttached ? 'Detach Start' : 'Attach Start'}
          </button>
        </div>

        {/* End Attachment */}
        <div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', flex: 1 }}>End:</span>
            <span style={{ fontSize: '10px', color: '#666' }}>
              {toAttached ? '✓ Attached' : '◯ Detached'}
            </span>
          </div>
          <button
            onClick={toAttached ? onDetachEnd : onAttachEnd}
            style={{
              width: '100%',
              padding: '4px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              background: toAttached ? '#e8f4f8' : '#fff8f0',
              color: '#333',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            {toAttached ? 'Detach End' : 'Attach End'}
          </button>
        </div>
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
