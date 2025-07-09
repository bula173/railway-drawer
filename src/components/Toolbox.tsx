import React, { useState } from "react";
import Button from "./Button";
import { Plus } from "lucide-react";
import * as LucideIcons from "lucide-react";

function groupBy<T>(arr: T[], key: (item: T) => string) {
  return arr.reduce((acc, item) => {
    const group = key(item) || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

interface ToolboxProps {
  toolbox: any[];
  setToolbox: (items: any[]) => void;
  setDraggedItem: (item: any) => void;
  showEditor?: boolean;
  setShowEditor?: (show: boolean) => void;
}

const Toolbox: React.FC<ToolboxProps> = ({
  toolbox,
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
    high: 48,
  });

  // Group tools by 'group' property
  const grouped = groupBy(toolbox, item => item.group || "Other");

  return (
    <div
      className="toolbox-panel flex flex-col items-center py-4 px-2 gap-2"
      style={{
        background: "#f4f6fa",
        borderRight: "1px solid #e0e0e0",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div className="toolbox-title" style={{ marginBottom: 12 }}>Toolbox</div>
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} style={{ width: "100%", marginBottom: 12 }}>
          <div style={{
            fontWeight: 600,
            color: "#1976d2",
            fontSize: "1rem",
            margin: "8px 0 4px 4px"
          }}>{group}</div>
          <div className="toolbox-grid">
            {items.map((item) => {
              const Icon = LucideIcons[item.iconName as keyof typeof LucideIcons];
              const isValidIcon =
                typeof Icon === "function" ||
                (typeof Icon === "object" && Icon !== null && "render" in Icon);

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    const { iconName, iconSvg, ...rest } = item;
                    e.dataTransfer.setData(
                      "application/railway-item",
                      JSON.stringify({
                        ...rest,
                        iconName,
                        iconSvg,
                        svg: item.iconSource === "custom" ? iconSvg : undefined,
                      })
                    );
                  }}
                  onDragEnd={() => setDraggedItem(null)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid #e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                    cursor: "grab",
                  }}
                  title={item.name}
                >
                  {item.iconSource === "custom" && item.iconSvg ? (
                    <span
                      style={{ display: "inline-block", width: 24, height: 24 }}
                      dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                    />
                  ) : isValidIcon ? (
                    <Icon size={20} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        style={{
          width: "100%",
          height: 44,
          borderRadius: 8,
          padding: 0,
          marginTop: 8,
          background: "#e0e0e0",
          color: "#333",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
        onClick={() => setShowEditor(true)}
        title="Add new shape"
      >
        <Plus size={24} />
      </Button>
      {showEditor && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.2)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowEditor(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              minWidth: 320,
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
              position: "relative",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Add New Shape</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={customData.name}
                onChange={e => setCustomData({ ...customData, name: e.target.value })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc" }}
              />
              <label style={{ fontWeight: 500 }}>Group</label>
              <input
                type="text"
                value={customData.group}
                onChange={e => setCustomData({ ...customData, group: e.target.value })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc" }}
                placeholder="e.g. Tracks, Signals"
              />
              <label style={{ fontWeight: 500 }}>Icon SVG</label>
              <textarea
                value={customData.iconSvg}
                onChange={e => setCustomData({ ...customData, iconSvg: e.target.value })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
                placeholder="<svg ...>...</svg>"
              />
              <label style={{ fontWeight: 500 }}>SVG (optional)</label>
              <textarea
                value={customData.svg}
                onChange={e => setCustomData({ ...customData, svg: e.target.value })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
                placeholder="<svg ...>...</svg>"
              />
              <label style={{ fontWeight: 500 }}>Width</label>
              <input
                type="number"
                value={customData.width}
                onChange={e => setCustomData({ ...customData, width: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc" }}
              />
              <label style={{ fontWeight: 500 }}>Height</label>
              <input
                type="number"
                value={customData.high}
                onChange={e => setCustomData({ ...customData, high: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 6, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                style={{ background: "#1976d2", color: "#fff" }}
                onClick={() => {
                  if (!customData.name) return;
                  setToolbox((prev: ToolboxItem[]) => [
                    ...prev,
                    {
                      ...customData,
                      id: customData.name.toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 7),
                      iconSource: "custom",
                    } as ToolboxItem,
                  ]);
                  setCustomData({
                    name: "",
                    group: "",
                    iconSvg: "",
                    svg: "",
                    width: 48,
                    high: 48,
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

export default Toolbox;
