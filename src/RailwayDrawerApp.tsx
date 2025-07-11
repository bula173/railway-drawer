import React, { useState, useRef, useEffect } from "react";
import toolboxConfig from "./assets/toolboxConfig.json";
import Toolbox from "./components/Toolbox";
import type { ToolboxItem } from "./components/Toolbox";
import PropertiesPanel from "./components/PropertiesPanel";
import DrawArea, { type DrawAreaRef } from "./components/DrawArea";
import TabPanel, { type DrawAreaTab } from "./components/TabPanel";
import type { DrawElement } from "./components/Elements";
import "./styles/tabpanel.css";

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

  // Missing refs - add these
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolboxInputRef = useRef<HTMLInputElement>(null);

  // Selected element state
  const [selectedElement, setSelectedElement] = useState<DrawElement | undefined>(undefined);

  // Tab management state
  const [tabs, setTabs] = useState<DrawAreaTab[]>([
    {
      id: 'tab-1',
      name: 'Drawing 1',
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
      selectedElementIds: [] // Add this line
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Export format state
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg" | "pdf">("png");

  // Panel widths and layout
  const [toolboxWidth, setToolboxWidth] = useState(148); // 3*44 + 2*8
  const [propertiesWidth, setPropertiesWidth] = useState(220);
  const tabPanelHeight= 40;

  // Missing state variables - add these
  const [showEditor, setShowEditor] = useState(false);
  const [drawAreaSize, setDrawAreaSize] = useState({ width: 2000, height: 1500 });
  const [zoom, setZoom] = useState(1);

  // Get current active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  // Tab management functions
  const handleTabCreate = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: DrawAreaTab = {
      id: newTabId,
      name: `Drawing ${tabs.length + 1}`,
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
      selectedElementIds: [] // Add this line
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    setSelectedElement(undefined);
  };

  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return; // Prevent closing last tab
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
    setSelectedElement(undefined);
  };

  const handleTabChange = (tabId: string) => {
    // Save current tab state before switching
    if (drawAreaRef.current && activeTab) {
      const currentElements = drawAreaRef.current.getElements();
      const currentGridVisible = drawAreaRef.current.getGridVisible();
      const currentBgColor = drawAreaRef.current.getSvgElement()?.style.backgroundColor || '#ffffff';
      
      // You'll also need to get the current selected element IDs from DrawArea
      // For now, we'll use an empty array, but you might want to expose this from DrawArea ref
      const currentSelectedIds: string[] = []; // TODO: Get from DrawArea ref if needed
      
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              elements: currentElements,
              gridVisible: currentGridVisible,
              backgroundColor: currentBgColor,
              selectedElementIds: currentSelectedIds // Add this line
            }
          : tab
      ));
    }
    
    setActiveTabId(tabId);
    setSelectedElement(undefined);
  };

  const handleTabRename = (tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
  };

  // Update DrawArea when tab changes
  useEffect(() => {
    if (drawAreaRef.current && activeTab) {
      drawAreaRef.current.setElements(activeTab.elements);
      drawAreaRef.current.setGridVisible(activeTab.gridVisible);
      const svgElement = drawAreaRef.current.getSvgElement();
      if (svgElement) {
        svgElement.style.backgroundColor = activeTab.backgroundColor;
      }
    }
  }, [activeTabId, activeTab]);

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
      setToolboxWidth(Math.max(120, startWidth + (moveEvent.clientX - startX)));
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
      setPropertiesWidth(Math.max(180, startWidth - (moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Add a new ref for the draw area container DOM element
  const drawAreaPanelRef = useRef<HTMLDivElement>(null);

  // Fix the resize observer to observe the DOM element, not the DrawAreaRef
  useEffect(() => {
    const node = drawAreaPanelRef.current; // This is the DOM element
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
      <div className="layout-main" style={{ height: `calc(100vh - ${tabPanelHeight}px)` }}>
        <div
          className="toolbox-panel"
          style={{ width: toolboxWidth, minWidth: 120 }}
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
          ref={drawAreaPanelRef} // Add this ref to the container
          className="draw-area-panel"
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
          style={{ width: propertiesWidth, minWidth: 180 }}
        >
          <PropertiesPanel
            drawAreaRef={drawAreaRef}
            selectedElement={selectedElement}
            onElementChange={setSelectedElement}
          />
        </div>
      </div>

      {/* Bottom Tab Panel */}
      <div style={{ height: tabPanelHeight }}>
        <TabPanel
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={handleTabChange}
          onTabCreate={handleTabCreate}
          onTabClose={handleTabClose}
          onTabRename={handleTabRename}
        />
      </div>
    </div>
  );
};

export default RailwayDrawerApp;

