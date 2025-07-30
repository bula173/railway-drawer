import React, { useState, useEffect } from "react";
import type { DrawElement } from "./Elements";
import type { DrawAreaRef } from "./DrawArea";
import "../styles/properites.css";

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
  const [gridEnabled, setGridEnabled] = useState(false);

  // Update local grid state when component mounts or drawAreaRef changes
  useEffect(() => {
    const updateGridState = () => {
      if (drawAreaRef?.current) {
        setGridEnabled(drawAreaRef.current.getGridVisible());
      }
    };
    updateGridState();
    
    // Set up interval to check for changes (alternative approach)
    const interval = setInterval(updateGridState, 100);
    return () => clearInterval(interval);
  }, [drawAreaRef]);

  // Helper function to update element both in DrawArea and callback
  const updateElement = (updatedElement: DrawElement) => {
    // Update in DrawArea with history tracking for undo/redo
    if (drawAreaRef?.current) {
      const elements = drawAreaRef.current.getElements();
      const updatedElements = elements.map(el => 
        el.id === updatedElement.id ? updatedElement : el
      );
      drawAreaRef.current.updateElements(updatedElements);
    }
    
    // Call the callback to update parent state
    onElementChange?.(updatedElement);
  };

  if (!element || !element.id) {
    // Show DrawArea/global properties if nothing is selected
    return (
      <div className="properties-panel">
        <h2 className="properties-title">Draw Area Properties</h2>
        <div className="properties-content">
          <div className="properties-item">
            <b>Grid Enabled:</b>
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={e => {
                const newValue = e.target.checked;
                drawAreaRef?.current?.setGridVisible(newValue);
                setGridEnabled(newValue);
              }}
            />
          </div>
          <div className="properties-item">
            <b>Background Color:</b>
            <input
              type="color"
              value={drawAreaRef?.current?.getSvgElement()?.style.backgroundColor || "#ffffff"}
              onChange={e => {
                const svgElement = drawAreaRef?.current?.getSvgElement();
                if (svgElement) {
                  svgElement.style.backgroundColor = e.target.value;
                }
              }}
            />
          </div>
          <div className="properties-item">
            <b>Elements Count:</b> {drawAreaRef?.current?.getElements()?.length || 0}
          </div>
          <div className="properties-item">
            <b>Canvas Size:</b> 
            <div>Width: {drawAreaRef?.current?.getSvgElement()?.getAttribute('width') || 'N/A'}</div>
            <div>Height: {drawAreaRef?.current?.getSvgElement()?.getAttribute('height') || 'N/A'}</div>
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
    <div className="properties-panel">
      <h2 className="properties-title">Element Properties</h2>
      <div className="properties-content">
        <div className="properties-item">
          <b>ID:</b> {element.id}
        </div>
        <div className="properties-item">
          <b>Type:</b> {element.type}
        </div>
        <div className="properties-item">
          <b>Name:</b>
          <textarea
            value={element.name || ""}
            onChange={(e) => {
              const updatedElement = { ...element, name: e.target.value };
              updateElement(updatedElement);
              onChangeName?.(element.id, e.target.value);
            }}
            rows={2}
            className="properties-textarea"
          />
        </div>
        <div className="properties-item">
          <b>Position:</b> ({x}, {y})
        </div>
        <div className="properties-item">
          <b>Size:</b> {width} × {height}
        </div>
        {/* Add more element properties as needed */}
        {element.textRegions && element.textRegions.length > 0 && (
          <div className="properties-text-regions">
            <b>Text Regions:</b>
            <ul>
              {element.textRegions.map((region: { id: string; text: string }, index: number) => (
                <li key={index} className="properties-text-region-item">
                  <b>ID:</b> {region.id}, <b>Text:</b>
                  <textarea
                    value={region.text}
                    onChange={(e) => {
                      const updatedRegions = element.textRegions?.map((r: any, i: number) =>
                        i === index ? { ...r, text: e.target.value } : r
                      );
                      if (updatedRegions) {
                        const updatedElement = { ...element, textRegions: updatedRegions };
                        updateElement(updatedElement);
                      }
                    }}
                    rows={3}
                    className="properties-textarea"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;