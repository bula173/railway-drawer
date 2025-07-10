import React from "react";
import type { DrawElement } from "./Elements";

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
  onChangeName?: (id: string, name: string) => void;
}> = ({
  element,
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
    <div
      className="flex flex-col p-4"
      style={{
        width: 220,
        background: "#f4f6fa",
        borderLeft: "1px solid #e0e0e0",
        minWidth: 180,
      }}
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Properties</h2>
      <div style={{ fontSize: 14 }}>
        <div>
          <b>ID:</b> {element.id}
        </div>
        <div>
          <b>Type:</b> {element.type}
        </div>
        <div>
          <b>Name:</b>{" "}
          <input
            value={element.name || ""}
            onChange={e => onChangeName?.(element.id, e.target.value)}
          />
        </div>
        <div>
          <b>Start:</b> ({x}, {y})
        </div>
        <div>
          <b>End:</b> ({x2}, {y2})
        </div>
        <div>
          <b>Width:</b> {width}
        </div>
        <div>
          <b>Height:</b> {height}
        </div>
        {typeof element.rotation === "number" && (
          <div>
            <b>Rotation:</b> {element.rotation}°
          </div>
        )}
        {typeof element.text === "string" && element.type === "text" && (
          <div>
            <b>Text:</b> {element.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;