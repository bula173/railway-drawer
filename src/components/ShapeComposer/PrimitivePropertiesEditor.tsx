/**
 * @file PrimitivePropertiesEditor.tsx
 * @brief Edit properties of selected primitive element
 *
 * Provides forms to edit all properties of the selected primitive
 */

import React, { useCallback } from 'react';
import { PrimitiveElement } from '../../types/shapeComposer';
import './styles/propertiesEditor.css';

export interface PrimitivePropertiesEditorProps {
  element?: PrimitiveElement;
  onUpdate?: (updates: Partial<PrimitiveElement>) => void;
}

/**
 * Editor for primitive element properties
 */
export const PrimitivePropertiesEditor: React.FC<PrimitivePropertiesEditorProps> = ({
  element,
  onUpdate,
}) => {
  const handleNumberInput = useCallback(
    (key: string, value: string) => {
      const num = parseFloat(value) || 0;
      onUpdate?.({ [key]: num } as any);
    },
    [onUpdate]
  );

  const handleTextInput = useCallback(
    (key: string, value: string) => {
      onUpdate?.({ [key]: value } as any);
    },
    [onUpdate]
  );

  const handleColorInput = useCallback(
    (key: string, value: string) => {
      onUpdate?.({ [key]: value } as any);
    },
    [onUpdate]
  );

  const updateNestedProperty = useCallback(
    (parent: string, key: string, value: any) => {
      if (!element) return;
      const parentObj = (element as any)[parent] || {};
      onUpdate?.({
        [parent]: {
          ...parentObj,
          [key]: value,
        },
      } as any);
    },
    [element, onUpdate]
  );

  if (!element) {
    return (
      <div className="properties-editor empty">
        <p>Select an element to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="properties-editor">
      <div className="editor-section">
        <h4>Position & Size</h4>
        <div className="property-group">
          <label>X</label>
          <input
            type="number"
            value={element.x}
            onChange={e => handleNumberInput('x', e.target.value)}
          />
        </div>
        <div className="property-group">
          <label>Y</label>
          <input
            type="number"
            value={element.y}
            onChange={e => handleNumberInput('y', e.target.value)}
          />
        </div>
        <div className="property-group">
          <label>Z-Index</label>
          <input
            type="number"
            value={element.zIndex || 0}
            onChange={e => handleNumberInput('zIndex', e.target.value)}
          />
        </div>
      </div>

      <div className="editor-section">
        <h4>Style</h4>
        <div className="property-group">
          <label>Fill</label>
          <input
            type="color"
            value={element.fill || '#ffffff'}
            onChange={e => handleColorInput('fill', e.target.value)}
          />
          <input
            type="text"
            value={element.fill || ''}
            placeholder="Color"
            onChange={e => handleColorInput('fill', e.target.value)}
            style={{ width: '70px' }}
          />
        </div>
        <div className="property-group">
          <label>Stroke</label>
          <input
            type="color"
            value={element.stroke || '#000000'}
            onChange={e => handleColorInput('stroke', e.target.value)}
          />
          <input
            type="text"
            value={element.stroke || ''}
            placeholder="Color"
            onChange={e => handleColorInput('stroke', e.target.value)}
            style={{ width: '70px' }}
          />
        </div>
        <div className="property-group">
          <label>Stroke Width</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={element.strokeWidth || 1}
            onChange={e => handleNumberInput('strokeWidth', e.target.value)}
          />
        </div>
        <div className="property-group">
          <label>Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={element.opacity ?? 1}
            onChange={e => handleNumberInput('opacity', e.target.value)}
          />
          <span className="opacity-value">{((element.opacity ?? 1) * 100).toFixed(0)}%</span>
        </div>
        <div className="property-group">
          <label>Rotation</label>
          <input
            type="number"
            min="0"
            max="360"
            value={element.rotation || 0}
            onChange={e => handleNumberInput('rotation', e.target.value)}
          />
          <span>°</span>
        </div>
      </div>

      {/* Type-specific properties */}
      {element.type === 'circle' && element.circle && (
        <div className="editor-section">
          <h4>Circle</h4>
          <div className="property-group">
            <label>Radius</label>
            <input
              type="number"
              min="1"
              value={element.circle.radius}
              onChange={e =>
                updateNestedProperty('circle', 'radius', parseFloat(e.target.value) || 10)
              }
            />
          </div>
        </div>
      )}

      {element.type === 'rectangle' && element.rectangle && (
        <div className="editor-section">
          <h4>Rectangle</h4>
          <div className="property-group">
            <label>Width</label>
            <input
              type="number"
              min="1"
              value={element.rectangle.width}
              onChange={e =>
                updateNestedProperty('rectangle', 'width', parseFloat(e.target.value) || 50)
              }
            />
          </div>
          <div className="property-group">
            <label>Height</label>
            <input
              type="number"
              min="1"
              value={element.rectangle.height}
              onChange={e =>
                updateNestedProperty('rectangle', 'height', parseFloat(e.target.value) || 50)
              }
            />
          </div>
          <div className="property-group">
            <label>Border Radius</label>
            <input
              type="number"
              min="0"
              value={element.rectangle.rx || 0}
              onChange={e =>
                updateNestedProperty('rectangle', 'rx', parseFloat(e.target.value) || 0)
              }
            />
          </div>
        </div>
      )}

      {element.type === 'line' && element.line && (
        <div className="editor-section">
          <h4>Line</h4>
          <div className="property-group">
            <label>End X</label>
            <input
              type="number"
              value={element.line.x2}
              onChange={e => updateNestedProperty('line', 'x2', parseFloat(e.target.value) || 50)}
            />
          </div>
          <div className="property-group">
            <label>End Y</label>
            <input
              type="number"
              value={element.line.y2}
              onChange={e => updateNestedProperty('line', 'y2', parseFloat(e.target.value) || 50)}
            />
          </div>
        </div>
      )}

      {element.type === 'text' && element.text && (
        <div className="editor-section">
          <h4>Text</h4>
          <div className="property-group">
            <label>Content</label>
            <input
              type="text"
              value={element.text.content}
              onChange={e => updateNestedProperty('text', 'content', e.target.value)}
            />
          </div>
          <div className="property-group">
            <label>Font Size</label>
            <input
              type="number"
              min="1"
              value={element.text.fontSize}
              onChange={e => updateNestedProperty('text', 'fontSize', parseFloat(e.target.value) || 14)}
            />
          </div>
          <div className="property-group">
            <label>Font Family</label>
            <select
              value={element.text.fontFamily || 'Arial'}
              onChange={e => updateNestedProperty('text', 'fontFamily', e.target.value)}
            >
              <option>Arial</option>
              <option>Helvetica</option>
              <option>Times New Roman</option>
              <option>Courier New</option>
              <option>Verdana</option>
            </select>
          </div>
          <div className="property-group">
            <label>Text Anchor</label>
            <select
              value={element.text.textAnchor || 'middle'}
              onChange={e =>
                updateNestedProperty('text', 'textAnchor', e.target.value as any)
              }
            >
              <option value="start">Start</option>
              <option value="middle">Middle</option>
              <option value="end">End</option>
            </select>
          </div>
        </div>
      )}

      {element.type === 'arc' && element.arc && (
        <div className="editor-section">
          <h4>Arc</h4>
          <div className="property-group">
            <label>Radius</label>
            <input
              type="number"
              min="1"
              value={element.arc.radius}
              onChange={e => updateNestedProperty('arc', 'radius', parseFloat(e.target.value) || 40)}
            />
          </div>
          <div className="property-group">
            <label>Start Angle</label>
            <input
              type="number"
              min="0"
              max="360"
              value={element.arc.startAngle}
              onChange={e =>
                updateNestedProperty('arc', 'startAngle', parseFloat(e.target.value) || 0)
              }
            />
            <span>°</span>
          </div>
          <div className="property-group">
            <label>End Angle</label>
            <input
              type="number"
              min="0"
              max="360"
              value={element.arc.endAngle}
              onChange={e =>
                updateNestedProperty('arc', 'endAngle', parseFloat(e.target.value) || 90)
              }
            />
            <span>°</span>
          </div>
        </div>
      )}
    </div>
  );
};
