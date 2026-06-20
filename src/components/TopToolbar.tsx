/**
 * @file TopToolbar.tsx
 * @brief Professional top toolbar with essential controls
 */

import React from 'react';
import { Save, Plus, Trash2, Undo2, Redo2, ZoomIn, ZoomOut, Grid3x3 } from 'lucide-react';

interface TopToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  gridVisible: boolean;
  onGridToggle: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  gridVisible,
  onGridToggle,
}) => {
  return (
    <div className="h-12 bg-white border-b border-slate-200 flex items-center gap-4 px-4 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">RD</span>
        </div>
        <span className="text-sm font-semibold text-slate-800">Railway Drawer</span>
      </div>

      {/* File Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSave}
          title="Save (Ctrl+S)"
          className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-slate-900"
        >
          <Save size={18} />
        </button>
      </div>

      {/* Edit Actions */}
      <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Redo2 size={18} />
        </button>
      </div>

      {/* View Actions */}
      <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
        <button
          onClick={onGridToggle}
          title={gridVisible ? 'Hide Grid' : 'Show Grid'}
          className={`p-2 rounded transition-colors ${
            gridVisible
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Grid3x3 size={18} />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-slate-900"
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={onZoomReset}
          className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded transition-colors text-slate-700 min-w-[50px]"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-slate-900"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help */}
      <div className="text-xs text-slate-500 pr-2 border-l border-slate-200 pl-2">
        Click & type to edit text • Double-click shapes for options
      </div>
    </div>
  );
};
