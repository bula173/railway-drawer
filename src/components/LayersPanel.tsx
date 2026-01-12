import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Layers, Plus } from 'lucide-react';
import type { Layer } from '../types';

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onLayerToggleVisibility: (id: string) => void;
  onLayerToggleLock: (id: string) => void;
  onLayerSelect: (id: string) => void;
  onAddLayer: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onLayerToggleVisibility,
  onLayerToggleLock,
  onLayerSelect,
  onAddLayer
}) => {
  return (
    <div className="bg-white border-t border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-slate-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Layers</span>
        </div>
        <button 
          onClick={onAddLayer}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
          title="Add New Layer"
        >
          <Plus size={14} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {[...layers].reverse().map(layer => (
          <div 
            key={layer.id}
            onClick={() => onLayerSelect(layer.id)}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
              activeLayerId === layer.id 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLayerToggleVisibility(layer.id);
              }}
              className={`p-1 rounded hover:bg-slate-200 transition-colors ${layer.visible ? 'text-blue-500' : 'text-slate-400'}`}
              title={layer.visible ? "Hide Layer" : "Show Layer"}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLayerToggleLock(layer.id);
              }}
              className={`p-1 rounded hover:bg-slate-200 transition-colors ${layer.locked ? 'text-red-500' : 'text-slate-400'}`}
              title={layer.locked ? "Unlock Layer" : "Lock Layer"}
            >
              {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            
            <span className={`text-xs flex-1 truncate ${activeLayerId === layer.id ? 'font-bold text-blue-700' : 'text-slate-600'}`}>
              {layer.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
