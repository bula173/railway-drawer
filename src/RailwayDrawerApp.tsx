import React, { useState, useRef, useEffect } from "react";
import toolboxConfig from "./assets/toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import type { ToolboxItem } from "./components/Toolbox";
import PropertiesPanel from "./components/PropertiesPanel";
import DrawArea, { type DrawAreaRef } from "./components/DrawArea";
import type { DrawElement } from "./components/Elements";

// Grid settings
const GRID_SIZE = 40;

/**
 * Main application component for the Railway Drawer.
 * Handles toolbox, drawing area, properties panel, file operations, and layout.
 * 
 * @component
 * @returns {JSX.Element} The rendered RailwayDrawerApp component.
 */
const RailwayDrawerApp = () => {
  // Toolbox state
  const [toolbox, setToolbox] = useState<ToolboxItem[]>(toolboxConfig as ToolboxItem[]);

  // Ref for the DrawArea component instance
  const drawAreaRef = useRef<DrawAreaRef>(null);

  // Selected element state
  const [selectedElement, setSelectedElement] = useState<DrawElement | undefined>(undefined);

  // Export format state
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg" | "pdf">("png");

  // Panel widths and layout
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8
  const [propertiesWidth, setPropertiesWidth] = useState(220);
  const minPanelWidth = 148; // 3*44 + 2*8
  const [drawAreaSize, setDrawAreaSize] = useState({ width: 1200, height: 800 });
  const drawAreaPanelRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolboxInputRef = useRef<HTMLInputElement>(null);

  // Show shape editor modal
  const [showEditor, setShowEditor] = useState(false);

  // Dummy setter for dragged item (required by Toolbox)
  const setDraggedItem = () => {};

  // Save the current elements as a JSON file using DrawArea ref
  const saveAsJson = () => {
    const elements = drawAreaRef.current?.getElements?.();
    if (!elements) return;
    const data = JSON.stringify({ elements }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "railway_drawing.json";
    link.click();
  };

  // Load elements from a JSON file using DrawArea ref
  const loadFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            drawAreaRef.current?.setElements?.(parsed.elements || []);
          } catch (err) {
            drawAreaRef.current?.setElements?.([]);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Export the drawing as an image (PNG, JPG, SVG, or PDF)
  const exportToImage = () => {
    const node = drawAreaRef.current?.getSvgElement?.();
    if (!node) return;
    if (exportFormat === "svg") {
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
          htmlToImage.toSvg(node as unknown as HTMLElement).then((dataUrl: string) => {
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
    import("html-to-image").then(htmlToImage => {
      const fn =
        exportFormat === "jpg"
          ? htmlToImage.toJpeg
          : htmlToImage.toSvg;
      fn(node as unknown as HTMLElement).then((dataUrl: string) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `railway_drawing.${exportFormat}`;
        link.click();
      });
    });
  };

  // Save the toolbox configuration as a JSON file
  const saveToolboxAsJson = () => {
    const data = JSON.stringify(
      toolbox.map(({ ...rest }) => ({ ...rest })),
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "toolbox_config.json";
    link.click();
  };

  // Load toolbox configuration from a JSON file
  const loadToolboxFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            setToolbox(
              parsed.map((item: any) => ({
                ...item,
                iconSvg: item.iconSource === "custom" ? item.iconSvg || item.shape : undefined,
                iconName: item.iconName,
              }))
            );
          } catch (err) {
            // ignore
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Panel resizing handlers
  const startResizeToolbox = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = toolboxWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setToolboxWidth(Math.max(minPanelWidth, startWidth + (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const startResizeProperties = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = propertiesWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setPropertiesWidth(Math.max(minPanelWidth, startWidth - (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Resize observer for draw area
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

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));
  const handleZoomReset = () => setZoom(1);

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
            showEditor={showEditor}
            setShowEditor={setShowEditor}
            setDraggedItem={setDraggedItem}
            drawAreaRef={drawAreaRef}
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
            ref={drawAreaRef}
            GRID_WIDTH={drawAreaSize.width}
            GRID_HEIGHT={drawAreaSize.height}
            GRID_SIZE={GRID_SIZE}
            zoom={zoom}
            selectedElement={selectedElement}
            setSelectedElement={setSelectedElement}
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
            drawAreaRef={drawAreaRef}
            selectedElement={selectedElement}
            onElementChange={setSelectedElement}
          />
        </div>
      </div>
    </div>
  );
};

export default RailwayDrawerApp;

