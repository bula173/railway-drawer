/**
 * @file FileToolbar.tsx
 * @brief File operations toolbar for mxGraph editor
 */

import React, { useState, useCallback } from 'react';
import { Save, File, Upload, Download, Settings } from 'lucide-react';
import { DrawioFileDialog } from './DrawioFileDialog';
import type { UseDrawioFileOpsResult } from '../hooks/useDrawioFileOps';
import './styles/fileToolbar.css';

export interface FileToolbarProps {
  fileOps: UseDrawioFileOpsResult;
  onSave?: () => void;
}

/**
 * File operations toolbar
 */
export const FileToolbar: React.FC<FileToolbarProps> = ({ fileOps, onSave }) => {
  const [showDialog, setShowDialog] = useState(false);

  const handleSaveClick = useCallback(async () => {
    if (fileOps.file) {
      try {
        await fileOps.saveFile(fileOps.file.xml);
        onSave?.();
      } catch (error) {
        console.error('Failed to save:', error);
      }
    }
  }, [fileOps, onSave]);

  const handleAutoSaveToggle = useCallback(() => {
    fileOps.toggleAutoSave();
  }, [fileOps]);

  return (
    <>
      <div className="file-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-icon-btn"
            onClick={() => setShowDialog(true)}
            title="File Manager (Ctrl+Shift+O)"
          >
            <File size={18} />
          </button>

          <button
            className="toolbar-icon-btn"
            onClick={handleSaveClick}
            disabled={fileOps.isSaving}
            title="Save File (Ctrl+S)"
          >
            <Save size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className={`toolbar-icon-btn ${fileOps.autoSaveEnabled ? 'active' : ''}`}
            onClick={handleAutoSaveToggle}
            title={`Auto-save: ${fileOps.autoSaveEnabled ? 'On' : 'Off'}`}
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="file-status">
          <span className="filename" title={fileOps.filename}>
            {fileOps.filename}
          </span>
          {fileOps.lastSaved && (
            <span className="last-saved">
              Saved {new Date(fileOps.lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog-wrapper" onClick={e => e.stopPropagation()}>
            <DrawioFileDialog
              fileOps={fileOps}
              onClose={() => setShowDialog(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};
