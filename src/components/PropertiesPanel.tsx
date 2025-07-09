import React from "react";
import type { DrawElement } from "../types/Element";

const PropertiesPanel: React.FC<{ element?: DrawElement; onChangeName?: (id: string, name: string) => void }> = ({ element, onChangeName }) => {
  if (!element) {
    element = { id: "", type: "", x: 0, y: 0, name: "", icon: "", draw: {}, length: 0, rotation: 0 } as DrawElement; // Default empty element
  }
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
          <b>X:</b> {Math.round(element.x)}
        </div>
        <div>
          <b>Y:</b> {Math.round(element.y)}
        </div>
        {/* Add more properties as needed */}
      </div>
    </div>
  );
};

export default PropertiesPanel;