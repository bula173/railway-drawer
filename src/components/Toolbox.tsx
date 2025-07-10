import React, { useState } from "react";
import Button from "./Button";
import { Plus } from "lucide-react";
import "../styles/toolbox.css";

/**
 * Groups an array of items by a key function.
 * @template T The type of items in the array.
 * @param arr The array to group.
 * @param key A function that returns the group key for an item.
 * @returns An object mapping group keys to arrays of items.
 */
function groupBy<T>(arr: T[], key: (item: T) => string) {
  return arr.reduce((acc, item) => {
    const group = key(item) || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Type for a toolbox item.
 */
export interface ToolboxItem {
  id: string;
  name: string;
  group?: string;
  iconSvg?: string;
  shape?: string;
  svg?: string;
  width: number;
  height: number; // <-- fix here
}

/**
 * Props for the Toolbox component.
 * @interface ToolboxProps
 * @property toolbox - The array of toolbox items.
 * @property setToolbox - Function to update the toolbox items.
 * @property setDraggedItem - Function to set the currently dragged item.
 * @property showEditor - Optional: Whether the editor modal is shown.
 * @property setShowEditor - Optional: Function to set the editor modal visibility.
 */
interface ToolboxProps {
  toolbox: ToolboxItem[];
  setToolbox: (items: ToolboxItem[] | ((prev: ToolboxItem[]) => ToolboxItem[])) => void;
  setDraggedItem: (item: ToolboxItem | null) => void;
  showEditor?: boolean;
  setShowEditor?: (show: boolean) => void;
}

/**
 * Toolbox component for displaying and managing toolbox items.
 * Allows grouping, drag-and-drop, and adding new custom shapes.
 * 
 * @component
 * @param {ToolboxProps} props - The props for the Toolbox component.
 * @returns {JSX.Element} The rendered Toolbox component.
 */
const Toolbox: React.FC<ToolboxProps> = ({
  toolbox: initialToolbox,
  setToolbox,
  setDraggedItem,
  showEditor: showEditorProp,
  setShowEditor: setShowEditorProp,
}) => {
  // Use prop if provided (from menu), else local state (from Add button)
  const [showEditorLocal, setShowEditorLocal] = useState(false);
  const showEditor = showEditorProp !== undefined ? showEditorProp : showEditorLocal;
  const setShowEditor = setShowEditorProp || setShowEditorLocal;

  const [customData, setCustomData] = useState({
    name: "",
    group: "",
    iconSvg: "",
    svg: "",
    width: 48,
    height: 48, // <-- fix here
  });

  // Group tools by 'group' property
  const grouped = groupBy(initialToolbox, item => item.group || "Other");

  return (
    <div className="toolbox-panel">
      <div className="toolbox-title">Toolbox</div>
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="toolbox-group">
          <div className="toolbox-group-title">{group}</div>
          <div className="toolbox-grid">
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    const { iconSvg, ...rest } = item;
                    e.dataTransfer.setData(
                      "application/railway-item",
                      JSON.stringify({
                        ...rest,
                        iconSvg,
                        svg: iconSvg,
                      })
                    );
                  }}
                  onDragEnd={() => setDraggedItem(null)}
                  className="toolbox-item"
                  title={item.name}
                >
                  {/* If iconSvg is "default", render the shape SVG scaled to 24x24, else use iconSvg */}
                  {item.iconSvg === "default" && item.shape ? (
                    <svg
                      width={24}
                      height={24}
                      viewBox={`0 0 ${item.width || 48} ${item.height || 48}`}
                      dangerouslySetInnerHTML={{ __html: item.shape }}
                    />
                  ) : item.iconSvg ? (
                    <span
                      style={{ display: "inline-block", width: 24, height: 24 }}
                      dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        className="toolbox-add-btn"
        onClick={() => setShowEditor(true)}
        title="Add new shape"
      >
        <Plus size={24} />
      </Button>
      {showEditor && (
        <div className="toolbox-modal-backdrop" onClick={() => setShowEditor(false)}>
          <div
            className="toolbox-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="toolbox-modal-title">Add New Shape</div>
            <div className="toolbox-modal-fields">
              <label>Name</label>
              <input
                type="text"
                value={customData.name}
                onChange={e => setCustomData({ ...customData, name: e.target.value })}
              />
              <label>Group</label>
              <input
                type="text"
                value={customData.group}
                onChange={e => setCustomData({ ...customData, group: e.target.value })}
                placeholder="e.g. Tracks, Signals"
              />
              <label>Icon SVG</label>
              <textarea
                value={customData.iconSvg}
                onChange={e => setCustomData({ ...customData, iconSvg: e.target.value })}
                placeholder="<svg ...>...</svg>"
              />
              <label>SVG (optional)</label>
              <textarea
                value={customData.svg}
                onChange={e => setCustomData({ ...customData, svg: e.target.value })}
                placeholder="<svg ...>...</svg>"
              />
              <label>Width</label>
              <input
                type="number"
                value={customData.width}
                onChange={e => setCustomData({ ...customData, width: Number(e.target.value) })}
              />
              <label>Height</label>
              <input
                type="number"
                value={customData.height}
                onChange={e => setCustomData({ ...customData, height: Number(e.target.value) })} // <-- fix here
              />
            </div>
            <div className="toolbox-modal-actions">
              <Button
                style={{ background: "#1976d2", color: "#fff" }}
                onClick={() => {
                  if (!customData.name) return;
                  setToolbox((prev: ToolboxItem[]) => [
                    ...prev,
                    {
                      ...customData,
                      id: customData.name.toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 7),
                    } as ToolboxItem,
                  ]);
                  setCustomData({
                    name: "",
                    group: "",
                    iconSvg: "",
                    svg: "",
                    width: 48,
                    height: 48, // <-- fix here
                  });
                  setShowEditor(false);
                }}
              >
                Add
              </Button>
              <Button
                style={{ background: "#e0e0e0", color: "#333" }}
                onClick={() => setShowEditor(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Exports the Toolbox component.
 */
export default Toolbox;
