/**
 * @file FloatingLayersPanel.tsx
 * @brief Floating/dockable layers panel
 */

import React, { useState, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
import { LayersPanel } from './LayersPanel';
import type { Layer } from '../types';

interface FloatingLayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onLayerToggleVisibility: (id: string) => void;
  onLayerToggleLock: (id: string) => void;
  onLayerSelect: (id: string) => void;
  onAddLayer: () => void;
  onClose: () => void;
  isDocked?: boolean;
}

export const FloatingLayersPanel: React.FC<FloatingLayersPanelProps> = ({
  layers,
  activeLayerId,
  onLayerToggleVisibility,
  onLayerToggleLock,
  onLayerSelect,
  onAddLayer,
  onClose,
  isDocked = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 400 });
  const [size, setSize] = useState({ width: 280, height: 350 });
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setPosition({
        x: dragStartRef.current.startX + deltaX,
        y: dragStartRef.current.startY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (isDocked) {
    // Docked version (renders in sidebar)
    return (
      <div className="flex flex-col h-full border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold uppercase text-slate-700">Layers</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
            title="Close"
          >
            <X size={14} className="text-slate-600" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onLayerToggleVisibility={onLayerToggleVisibility}
            onLayerToggleLock={onLayerToggleLock}
            onLayerSelect={onLayerSelect}
            onAddLayer={onAddLayer}
          />
        </div>
      </div>
    );
  }

  // Floating version
  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 5000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        border: '1px solid #ddd',
      }}
    >
      {/* Title Bar */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ddd',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          gap: '8px',
        }}
      >
        <GripVertical size={14} className="text-slate-600" />
        <h3 className="text-xs font-bold uppercase text-slate-700 flex-1">Layers</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-300 rounded transition-colors"
          title="Close"
        >
          <X size={14} className="text-slate-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onLayerToggleVisibility={onLayerToggleVisibility}
          onLayerToggleLock={onLayerToggleLock}
          onLayerSelect={onLayerSelect}
          onAddLayer={onAddLayer}
        />
      </div>
    </div>
  );
};
