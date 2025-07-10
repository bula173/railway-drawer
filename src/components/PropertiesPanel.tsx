import React from "react";
import type { DrawElement } from "./Elements";
import "../styles/properites.css";

/**
 * PropertiesPanel component for displaying and editing properties of a selected drawing element.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {DrawElement} [props.element] - The element whose properties are shown.
 * @param {(id: string, name: string) => void} [props.onChangeName] - Handler for name change.
 * @returns {JSX.Element} The rendered properties panel.
 */
const PropertiesPanel: React.FC<{
  element?: DrawElement;
  drawAreaRef?: React.RefObject<SVGSVGElement | null>; // Reference to DrawArea
  onChangeName?: (id: string, name: string) => void;
}> = ({
  element,
  drawAreaRef,
  onChangeName,
}) => {
  /**
   * If no element is provided, use a default empty element.
   * @type {DrawElement}
   */
  if (!element) {
    element = {
      id: "",
      type: "",
      name: "",
      iconSvg: "",
      shape: "",
      width: 0,
      height: 0,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      rotation: 0,
      text: "",
    } as DrawElement;
  }

  /**
   * The X coordinate of the start point.
   * @type {number}
   */
  const x = Math.round(element.start?.x ?? 0);

  /**
   * The Y coordinate of the start point.
   * @type {number}
   */
  const y = Math.round(element.start?.y ?? 0);

  /**
   * The X coordinate of the end point.
   * @type {number}
   */
  const x2 = Math.round(element.end?.x ?? 0);

  /**
   * The Y coordinate of the end point.
   * @type {number}
   */
  const y2 = Math.round(element.end?.y ?? 0);

  /**
   * The width of the element (absolute difference between x2 and x).
   * @type {number}
   */
  const width = Math.abs(x2 - x);

  /**
   * The height of the element (absolute difference between y2 and y).
   * @type {number}
   */
  const height = Math.abs(y2 - y);

  return (
    <div className="properties-panel">
      <h2 className="properties-title">Properties</h2>
      <div className="properties-content">
        {element.id !== "global" ? (
          <>
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
                onChange={(e) => onChangeName?.(element.id, e.target.value)}
                rows={2}
                className="properties-textarea"
              />
            </div>
            <div className="properties-item">
              <b>Start:</b> ({x}, {y})
            </div>
            <div className="properties-item">
              <b>End:</b> ({x2}, {y2})
            </div>
            <div className="properties-item">
              <b>Width:</b> {width}
            </div>
            <div className="properties-item">
              <b>Height:</b> {height}
            </div>
            {typeof element.rotation === "number" && (
              <div className="properties-item">
                <b>Rotation:</b> {element.rotation}°
              </div>
            )}
            {typeof element.text === "string" && element.type === "text" && (
              <div className="properties-item">
                <b>Text:</b> {element.text}
              </div>
            )}
            {element.textRegions && element.textRegions.length > 0 && (
              <div className="properties-text-regions">
                <b>Text Regions:</b>
                <ul>
                  {element.textRegions.map((region, index) => (
                    <li key={index} className="properties-text-region-item">
                      <b>ID:</b> {region.id}, <b>Text:</b>
                      <textarea
                        value={region.text}
                        onChange={(e) => {
                          const updatedRegions = element.textRegions?.map((r, i) =>
                            i === index ? { ...r, text: e.target.value } : r
                          );
                          if (updatedRegions) {
                            element.textRegions = updatedRegions; // Update textRegions directly

                            // Calculate required dimensions based on text content
                            const textLines = e.target.value.split("\n");
                            const maxLineWidth = Math.max(
                              ...textLines.map((line) => line.length * 8) // Approximate width per character
                            );
                            const requiredHeight = textLines.length * 20; // Approximate height per line

                            // Ensure width and height are initialized
                            element.width = element.width || 0;
                            element.height = element.height || 0;

                            // Update element dimensions if text exceeds bounds
                            if (maxLineWidth > element.width || requiredHeight > element.height) {
                              element.width = Math.max(element.width, maxLineWidth);
                              element.height = Math.max(element.height, requiredHeight);
                            }

                            onChangeName?.(element.id, element.name || ""); // Ensure name remains unchanged
                          }
                        }}
                        rows={3}
                        className="properties-textarea"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="properties-item">
              <b>Grid Enabled:</b>
              <input
                type="checkbox"
                checked={element.gridEnabled}
                onChange={(e) => {
                  element.setGridEnabled?.(e.target.checked);
                  if (drawAreaRef?.current) {
                    drawAreaRef.current.setAttribute("data-grid-enabled", e.target.checked.toString());
                  }
                }}
              />
            </div>
            <div className="properties-item">
              <b>Background Color:</b>
              <input
                type="color"
                value={element.backgroundColor || "#ffffff"}
                onChange={(e) => {
                  element.setBackgroundColor?.(e.target.value);
                  if (drawAreaRef?.current) {
                    drawAreaRef.current.style.backgroundColor = e.target.value;
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;