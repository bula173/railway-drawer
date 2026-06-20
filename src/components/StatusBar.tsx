/**
 * @file StatusBar.tsx
 * @brief Bottom status bar showing useful information
 */

import React from 'react';

interface StatusBarProps {
  selectedCount: number;
  totalElements: number;
  gridSize: number;
  zoom: number;
  cursorX?: number;
  cursorY?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  selectedCount,
  totalElements,
  gridSize,
  zoom,
  cursorX,
  cursorY,
}) => {
  return (
    <div className="h-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs text-slate-600 gap-8">
      {/* Left info */}
      <div className="flex items-center gap-6">
        <span>
          <span className="font-semibold text-slate-900">{selectedCount}</span> selected
        </span>
        <span className="text-slate-500">•</span>
        <span>
          <span className="font-semibold text-slate-900">{totalElements}</span> total
        </span>
        <span className="text-slate-500">•</span>
        <span>
          Grid: <span className="font-semibold text-slate-900">{gridSize}px</span>
        </span>
      </div>

      {/* Right info */}
      <div className="flex items-center gap-6">
        {cursorX !== undefined && cursorY !== undefined && (
          <>
            <span className="text-slate-500">•</span>
            <span>
              Position: <span className="font-semibold text-slate-900">{Math.round(cursorX)}, {Math.round(cursorY)}</span>
            </span>
          </>
        )}
        <span className="text-slate-500">•</span>
        <span>
          Zoom: <span className="font-semibold text-slate-900">{Math.round(zoom * 100)}%</span>
        </span>
      </div>
    </div>
  );
};
