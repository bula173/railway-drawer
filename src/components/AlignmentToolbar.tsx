/**
 * @file AlignmentToolbar.tsx
 * @brief UI toolbar for alignment and distribution operations
 *
 * Features:
 * - Align left, right, center buttons
 * - Align top, bottom, middle buttons
 * - Distribute horizontal, vertical buttons
 * - Smart guides visualization
 * - Keyboard shortcut hints
 */

import React, { useCallback } from 'react';
import type { DrawElement } from './Elements';
import { useAlignment } from '../hooks/useAlignment';
import { logger } from '../utils/logger';

/**
 * @interface AlignmentToolbarProps
 * @brief Props for AlignmentToolbar
 */
export interface AlignmentToolbarProps {
  selectedElements: DrawElement[];
  onElementsAligned?: (elements: DrawElement[]) => void;
  position?: 'top' | 'left' | 'right' | 'bottom';
  showLabels?: boolean;
}

/**
 * @component AlignmentToolbar
 * @brief Toolbar for element alignment operations
 *
 * Shows alignment and distribution buttons
 * based on number of selected elements
 */
export const AlignmentToolbar: React.FC<AlignmentToolbarProps> = ({
  selectedElements,
  onElementsAligned,
  position = 'top',
  showLabels = false,
}) => {
  const alignment = useAlignment();

  if (selectedElements.length < 2) {
    return null;
  }

  /**
   * Handle alignment operation
   */
  const handleAlignment = useCallback(
    (operation: 'left' | 'right' | 'centerH' | 'top' | 'bottom' | 'middleV' | 'distributeH' | 'distributeV') => {
      logger.info('AlignmentToolbar', 'Alignment operation', { operation, count: selectedElements.length });

      let result;
      switch (operation) {
        case 'left':
          result = alignment.doAlignLeft(selectedElements);
          break;
        case 'right':
          result = alignment.doAlignRight(selectedElements);
          break;
        case 'centerH':
          result = alignment.doAlignCenterH(selectedElements);
          break;
        case 'top':
          result = alignment.doAlignTop(selectedElements);
          break;
        case 'bottom':
          result = alignment.doAlignBottom(selectedElements);
          break;
        case 'middleV':
          result = alignment.doAlignMiddleV(selectedElements);
          break;
        case 'distributeH':
          result = alignment.doDistributeH(selectedElements);
          break;
        case 'distributeV':
          result = alignment.doDistributeV(selectedElements);
          break;
        default:
          return;
      }

      onElementsAligned?.(result.alignedElements);
    },
    [selectedElements, alignment, onElementsAligned]
  );

  /**
   * Get available operations
   */
  const info = alignment.getAlignmentInfo(selectedElements);
  if (!info) return null;

  /**
   * Button style
   */
  const buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    minWidth: showLabels ? 'auto' : '32px',
  };

  /**
   * Render align button
   */
  const renderButton = (
    operation: string,
    label: string,
    icon: string,
    shortcut?: string,
    enabled?: boolean
  ) => (
    <button
      key={operation}
      onClick={() => handleAlignment(operation as any)}
      disabled={!enabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        ...buttonStyle,
        opacity: enabled === false ? 0.5 : 1,
        cursor: enabled === false ? 'not-allowed' : 'pointer',
      }}
      onMouseOver={e => {
        if (enabled !== false) {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#e0e0e0';
          (e.currentTarget as HTMLElement).style.borderColor = '#999';
        }
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
        (e.currentTarget as HTMLElement).style.borderColor = '#ccc';
      }}
    >
      {showLabels ? label : icon}
    </button>
  );

  /**
   * Container style
   */
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  return (
    <div style={containerStyle}>
      {/* Horizontal alignment group */}
      <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #ddd', paddingRight: '8px' }}>
        <span style={{ fontSize: '10px', color: '#666', alignSelf: 'center', marginRight: '4px' }}>
          H
        </span>
        {renderButton('left', 'Align Left', '◀', 'Ctrl+L', info.canAlignH)}
        {renderButton('centerH', 'Align Center', '⏺', 'Ctrl+H', info.canAlignH)}
        {renderButton('right', 'Align Right', '▶', 'Ctrl+R', info.canAlignH)}
      </div>

      {/* Vertical alignment group */}
      <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #ddd', paddingRight: '8px' }}>
        <span style={{ fontSize: '10px', color: '#666', alignSelf: 'center', marginRight: '4px' }}>
          V
        </span>
        {renderButton('top', 'Align Top', '▲', 'Ctrl+T', info.canAlignV)}
        {renderButton('middleV', 'Align Middle', '⏺', 'Ctrl+M', info.canAlignV)}
        {renderButton('bottom', 'Align Bottom', '▼', 'Ctrl+B', info.canAlignV)}
      </div>

      {/* Distribution group */}
      {info.canDistribute && (
        <div style={{ display: 'flex', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: '#666', alignSelf: 'center', marginRight: '4px' }}>
            D
          </span>
          {renderButton('distributeH', 'Distribute H', '≡', 'Shift+H', true)}
          {renderButton('distributeV', 'Distribute V', '≣', 'Shift+V', true)}
        </div>
      )}

      {/* Info */}
      <div
        style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: '#999',
          minWidth: '80px',
          textAlign: 'right',
        }}
      >
        {selectedElements.length} selected
      </div>
    </div>
  );
};
