import React, { useState, useRef, useEffect } from "react";
import toolboxConfig from "./assets/toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import type { ToolboxItem } from "./components/Toolbox";
import PropertiesPanel from "./components/PropertiesPanel";
import DrawArea from "./components/DrawArea";
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
  /**
   * State for toolbox items.
   * @type {[ToolboxItem[], Function]}
   */
  const [toolbox, setToolbox] = useState<ToolboxItem[]>(toolboxConfig as ToolboxItem[]);

  /**
   * State for drawn elements.
   * @type {[DrawElement[], Function]}
   */
  const [elements, setElements] = useState<DrawElement[]>([]);

  /**
   * Ref for the SVG element in the draw area.
   * @type {React.RefObject<SVGSVGElement>}
   */
  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * State for export format.
   * @type {["png" | "jpg" | "svg" | "pdf", Function]}
   */
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg" | "pdf">("png");

  // UI state
  /**
   * State for hovered element ID.
   * @type {[string | null, Function]}
   */
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  /**
   * State for selected element ID.
   * @type {[string | null, Function]}
   */
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  /**
   * State for toolbox panel width.
   * @type {[number, Function]}
   */
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8

  /**
   * State for properties panel width.
   * @type {[number, Function]}
   */
  const [propertiesWidth, setPropertiesWidth] = useState(220);

  /**
   * Minimum panel width.
   * @type {number}
   */
  const minPanelWidth = 148; // 3*44 + 2*8

  /**
   * State for draw area size.
   * @type {[{width: number, height: number}, Function]}
   */
  const [drawAreaSize, setDrawAreaSize] = useState({ width: 1200, height: 800 });

  /**
   * Ref for the draw area panel div.
   * @type {React.RefObject<HTMLDivElement>}
   */
  const drawAreaPanelRef = useRef<HTMLDivElement>(null);

  // Zoom state
  /**
   * State for zoom level.
   * @type {[number, Function]}
   */
  const [zoom, setZoom] = useState(1);

  /**
   * Save the current elements as a JSON file.
   * @function
   */
  const saveAsJson = () => {
    console.log("[SAVE] Saving elements:", elements);
    const data = JSON.stringify({ elements }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "railway_drawing.json";
    link.click();
  };

  /**
   * Load elements from a JSON file.
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
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

  /**
   * Export the drawing as an image (PNG, JPG, SVG, or PDF).
   * @function
   */
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

    // PNG or JPG
    import("html-to-image").then(htmlToImage => {
      const fn =
        exportFormat === "jpg"
          ? htmlToImage.toJpeg
          : htmlToImage.toSvg; // Use toSvg for SVG elements
      fn(node as unknown as HTMLElement).then((dataUrl: string) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `railway_drawing.${exportFormat}`;
        link.click();
      });
    });
  };

  /**
   * Save the toolbox configuration as a JSON file.
   * @function
   */
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

  /**
   * Load toolbox configuration from a JSON file.
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
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

  /**
   * Handle changing the name of an element.
   * @function
   * @param {string} id - The element ID.
   * @param {string} name - The new name.
   */
  function handleChangeElementName(id: string, name: string): void {
    console.log("[PROPERTIES] Change name:", { id, name });
    setElements(prev =>
      prev.map(el =>
        el.id === id ? { ...el, name } : el
      )
    );
  }

  /**
   * Start resizing the toolbox panel.
   * @function
   * @param {React.MouseEvent} e - The mouse event.
   */
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

  /**
   * Start resizing the properties panel.
   * @function
   * @param {React.MouseEvent} e - The mouse event.
   */
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

  /**
   * The currently hovered element.
   * @type {DrawElement | undefined}
   */
  const hoveredElement = elements.find(el => el.id === hoveredElementId);

  /**
   * The IDs of selected elements.
   * @type {string[]}
   */
  const selectedElementIds = elements.filter(el => el.id === selectedElementId).map(el => el.id);

  /**
   * The last selected element ID.
   * @type {string | null}
   */
  const lastSelectedId = selectedElementIds[selectedElementIds.length - 1] || null;

  /**
   * The currently selected element.
   * @type {DrawElement | null}
   */
  const selectedElement = elements.find(el => el.id === lastSelectedId) || null;

  /**
   * Ref for the file input (drawing).
   * @type {React.RefObject<HTMLInputElement>}
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Ref for the file input (toolbox).
   * @type {React.RefObject<HTMLInputElement>}
   */
  const toolboxInputRef = useRef<HTMLInputElement>(null);

  /**
   * Effect to observe and update draw area size on resize.
   */
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

  /**
   * Zoom in handler.
   * @function
   */
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  /**
   * Zoom out handler.
   * @function
   */
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.2));
  };

  /**
   * Zoom reset handler.
   * @function
   */
  const handleZoomReset = () => {
    setZoom(1);
  };

  /**
   * State for showing the shape editor modal.
   * @type {[boolean, Function]}
   */
  const [showEditor, setShowEditor] = useState(false);

  /**
   * Dummy setter for dragged item (required by Toolbox).
   * @function
   */
  const setDraggedItem = () => {};

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
            selectedElementIds={selectedElementId ? [selectedElementId] : []}
            setSelectedElementIds={ids => setSelectedElementId(ids.at(-1) || null)}
            showGrid={true}
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
            element={hoveredElement || selectedElement || undefined}
            onChangeName={handleChangeElementName}
          />
        </div>
      </div>
    </div>
  );
};

export default RailwayDrawerApp;

