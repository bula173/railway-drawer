import React, { useState, useRef, useEffect } from "react";
import toolboxConfig from "./toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import PropertiesPanel from "./components/PropertiesPanel";
import DrawArea from "./components/DrawArea";
import type { DrawElement } from "./components/Elements";
import * as LucideIcons from "lucide-react";

// Grid settings
const GRID_SIZE = 40;

const RailwayDrawerApp = () => {
  const [showEditor, setShowEditor] = useState(false);
  const [toolbox, setToolbox] = useState(toolboxConfig);
  const [elements, setElements] = useState<DrawElement[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg" | "pdf">("png");

  // UI state
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8
  const [propertiesWidth, setPropertiesWidth] = useState(220);
  const [drawAreaWidth, setDrawAreaWidth] = useState<number | undefined>(undefined);
  const minPanelWidth = 148; // 3*44 + 2*8
  const minDrawAreaWidth = 300; // (and any logic using these)

  const [drawAreaSize, setDrawAreaSize] = useState({ width: 1200, height: 800 });
  const drawAreaPanelRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1);

  // Save/load/export logic
  const saveAsJson = () => {
    console.log("[SAVE] Saving elements:", elements);
    const data = JSON.stringify({ elements }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "railway_drawing.json";
    link.click();
  };

  const loadFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("[LOAD] Loading drawing JSON file:", file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            console.log("[LOAD] Loaded elements:", parsed.elements);
            setElements(parsed.elements || []);
          } catch (err) {
            console.error("[LOAD] Failed to parse drawing JSON", err);
            setElements([]);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const exportToImage = () => {
    const node = svgRef.current;
    if (!node) return;

    if (exportFormat === "svg") {
      // Export SVG source
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(node);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "railway_drawing.svg";
      link.click();
      return;
    }

    if (exportFormat === "pdf") {
      import("jspdf").then(jsPDF => {
        import("html-to-image").then(htmlToImage => {
          htmlToImage.toPng(node).then((dataUrl: string) => {
            const pdf = new jsPDF.jsPDF({
              orientation: "landscape",
              unit: "px",
              format: [node.width.baseVal.value, node.height.baseVal.value],
            });
            pdf.addImage(
              dataUrl,
              "PNG",
              0,
              0,
              node.width.baseVal.value,
              node.height.baseVal.value
            );
            pdf.save("railway_drawing.pdf");
          });
        });
      });
      return;
    }

    // PNG or JPG
    import("html-to-image").then(htmlToImage => {
      const fn =
        exportFormat === "jpg"
          ? htmlToImage.toJpeg
          : htmlToImage.toPng;
      fn(node).then((dataUrl: string) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `railway_drawing.${exportFormat}`;
        link.click();
      });
    });
  };

  const saveToolboxAsJson = () => {
    console.log("[SAVE] Saving toolbox config:", toolbox);
    const data = JSON.stringify(
      toolbox.map(({ ...rest }) => ({ ...rest})),
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "toolbox_config.json";
    link.click();
  };

  const loadToolboxFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("[LOAD] Loading toolbox JSON file:", file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            console.log("[LOAD] Loaded toolbox config:", parsed);
            setToolbox(
              parsed.map((item: any) => ({
                ...item,
                iconSvg: item.iconSource === "custom" ? item.iconSvg || item.shape : undefined,
                iconName: item.iconName,
              }))
            );
          } catch (err) {
            console.error("[LOAD] Failed to parse toolbox", err);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  function handleChangeElementName(id: string, name: string): void {
    console.log("[PROPERTIES] Change name:", { id, name });
    setElements(prev =>
      prev.map(el =>
        el.id === id ? { ...el, name } : el
      )
    );
  }

  // Panel resizing
  const startResizeToolbox = (e: React.MouseEvent) => {
    console.log("[RESIZE] Start resizing toolbox panel");
    const startX = e.clientX;
    const startWidth = toolboxWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setToolboxWidth(Math.max(minPanelWidth, startWidth + (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      console.log("[RESIZE] Toolbox panel resize finished");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizeProperties = (e: React.MouseEvent) => {
    console.log("[RESIZE] Start resizing properties panel");
    const startX = e.clientX;
    const startWidth = propertiesWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setPropertiesWidth(Math.max(minPanelWidth, startWidth - (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      console.log("[RESIZE] Properties panel resize finished");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizeDrawArea = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startDrawWidth = drawAreaWidth ?? (window.innerWidth - toolboxWidth - propertiesWidth - 12);
    const startPropsWidth = propertiesWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      let newDrawWidth = startDrawWidth + delta;
      let newPropsWidth = startPropsWidth - delta;

      // Enforce minimums
      if (newDrawWidth < minDrawAreaWidth) {
        newPropsWidth -= (minDrawAreaWidth - newDrawWidth);
        newDrawWidth = minDrawAreaWidth;
      }
      if (newPropsWidth < minPanelWidth) {
        newDrawWidth -= (minPanelWidth - newPropsWidth);
        newPropsWidth = minPanelWidth;
      }

      setDrawAreaWidth(newDrawWidth);
      setPropertiesWidth(newPropsWidth);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const hoveredElement = elements.find(el => el.id === hoveredElementId);
  const selectedElementIds = elements.filter(el => el.id === selectedElementId).map(el => el.id);
  const lastSelectedId = selectedElementIds[selectedElementIds.length - 1] || null;
  const selectedElement = elements.find(el => el.id === lastSelectedId) || null;

  // Add this helper for file input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolboxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const node = drawAreaPanelRef.current;
    if (!node) return;
    const observer = new window.ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDrawAreaSize({ width, height });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.2));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      {/* --- Standard Menu Bar --- */}
      <div className="menu-bar" style={{ position: "relative", zIndex: 100 }}>
        <div className="menu-dropdown">
          <button className="custom-btn" style={{ borderRadius: 0, borderRight: "1px solid #e0e0e0" }}>
            File
          </button>
          <div className="menu-dropdown-content">
            <div onClick={() => fileInputRef.current?.click()}>Open...</div>
            <div onClick={saveAsJson}>Save</div>
            <div>
              Export As
              <div className="menu-sub-dropdown">
                <div onClick={() => { setExportFormat("png"); exportToImage(); }}>PNG</div>
                <div onClick={() => { setExportFormat("jpg"); exportToImage(); }}>JPG</div>
                <div onClick={() => { setExportFormat("svg"); exportToImage(); }}>SVG</div>
                <div onClick={() => { setExportFormat("pdf"); exportToImage(); }}>PDF</div>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={loadFromJson}
          />
        </div>
        <div className="menu-dropdown">
          <button className="custom-btn" style={{ borderRadius: 0, borderRight: "1px solid #e0e0e0" }}>
            Toolbox
          </button>
          <div className="menu-dropdown-content">
            <div onClick={saveToolboxAsJson}>Save Toolbox</div>
            <div onClick={() => toolboxInputRef.current?.click()}>Open Toolbox Config</div>
            <div onClick={() => setShowEditor(true)}>Add new shape</div>
          </div>
          <input
            ref={toolboxInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={loadToolboxFromJson}
          />
        </div>
      </div>
      {/* Main Layout */}
      <div className="layout-main">
        <div
          className="toolbox-panel"
          style={{ width: toolboxWidth, minWidth: minPanelWidth }}
        >
          <Toolbox
            toolbox={toolbox}
            setToolbox={setToolbox}
            setDraggedItem={setDraggedItem}
            showEditor={showEditor}
            setShowEditor={setShowEditor}
          />
        </div>
        <div
          style={{
            width: 6,
            cursor: "ew-resize",
            background: "#e0e0e0",
            zIndex: 10,
          }}
          onMouseDown={startResizeToolbox}
        />
        <div
          className="draw-area-panel"
          ref={drawAreaPanelRef}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: 8 }}>
            <button onClick={handleZoomOut}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn}>+</button>
            <button onClick={handleZoomReset}>Reset</button>
          </div>
          <DrawArea
            svgRef={svgRef}
            zoom={zoom}
            GRID_WIDTH={drawAreaSize.width}
            GRID_HEIGHT={drawAreaSize.height}
            GRID_SIZE={GRID_SIZE}
            elements={elements}
            setElements={setElements}
            hoveredElementId={hoveredElementId}
            setHoveredElementId={setHoveredElementId}
            selectedElementId={selectedElementId}
            setSelectedElementId={setSelectedElementId}
            selectedElementIds={selectedElementId ? [selectedElementId] : []}
            setSelectedElementIds={ids => setSelectedElementId(ids.at(-1) || null)}
            showGrid={showGrid}
          />
        </div>
        <div
          style={{
            width: 6,
            cursor: "ew-resize",
            background: "#e0e0e0",
            zIndex: 10,
          }}
          onMouseDown={startResizeProperties}
        />
        <div
          className="properties-panel"
          style={{ width: propertiesWidth, minWidth: minPanelWidth }}
        >
          <PropertiesPanel
            element={hoveredElement || selectedElement}
            onChangeName={handleChangeElementName}
          />
        </div>
      </div>
    </div>
  );
};

export default RailwayDrawerApp;

