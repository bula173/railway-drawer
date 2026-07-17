/**
 * @file DrawioFileDialog.tsx
 * @brief File management dialog for draw.io files
 *
 * Features:
 * - New file creation
 * - Save/load files
 * - Import from disk
 * - Export to JSON/XML
 * - Backup management
 */

import React, { useState, useRef, useCallback } from 'react';
import { Save, Upload, Download, Trash2, Plus, Clock } from 'lucide-react';
import { logger } from '../utils/logger';
import type { UseDrawioFileOpsResult } from '../hooks/useDrawioFileOps';
import './styles/drawioFileDialog.css';

export interface DrawioFileDialogProps {
  fileOps: UseDrawioFileOpsResult;
  onClose?: () => void;
}

/**
 * File management dialog
 */
export const DrawioFileDialog: React.FC<DrawioFileDialogProps> = ({ fileOps, onClose }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'open' | 'new'>('current');
  const [newFilename, setNewFilename] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewFile = useCallback(() => {
    const name = newFilename.trim() || 'Untitled';
    fileOps.createNewFile(name);
    setNewFilename('');
    setActiveTab('current');
  }, [newFilename, fileOps]);

  const handleImportFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await fileOps.loadFileFromDisk(file);
        setActiveTab('current');
      } catch (error) {
        alert(`Failed to import file: ${error}`);
      }
    },
    [fileOps]
  );

  const handleExport = useCallback(
    (format: 'json' | 'xml') => {
      fileOps.downloadFile(format);
    },
    [fileOps]
  );

  const handleSave = useCallback(async () => {
    if (!fileOps.file) return;
    try {
      await fileOps.saveFile(fileOps.file.xml);
      alert('File saved successfully!');
    } catch (error) {
      alert(`Failed to save: ${error}`);
    }
  }, [fileOps]);

  const handleBackup = useCallback(() => {
    fileOps.createBackupNow();
    alert('Backup created successfully!');
  }, [fileOps]);

  const handleOpenFile = useCallback(
    (filename: string) => {
      fileOps.loadFile(filename);
      setActiveTab('current');
    },
    [fileOps]
  );

  const handleDeleteFile = useCallback(
    (filename: string) => {
      if (confirm(`Delete file "${filename}"?`)) {
        fileOps.deleteFile(filename);
      }
    },
    [fileOps]
  );

  const files = fileOps.listFiles();
  const formatLastSaved = fileOps.lastSaved
    ? new Date(fileOps.lastSaved).toLocaleString()
    : 'Not saved';

  return (
    <div className="drawio-file-dialog">
      {/* Header */}
      <div className="dialog-header">
        <h2>File Manager</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose} title="Close">
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="dialog-tabs">
        <button
          className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current
        </button>
        <button
          className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => setActiveTab('open')}
        >
          Open ({files.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          New
        </button>
      </div>

      {/* Tab Content */}
      <div className="dialog-content">
        {/* Current File */}
        {activeTab === 'current' && (
          <div className="tab-pane">
            {fileOps.file ? (
              <>
                <div className="file-info">
                  <div className="info-item">
                    <span className="label">Filename:</span>
                    <span className="value">{fileOps.file.filename}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Created:</span>
                    <span className="value">
                      {new Date(fileOps.file.metadata.created).toLocaleString()}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Last Modified:</span>
                    <span className="value">
                      {new Date(fileOps.file.metadata.modified).toLocaleString()}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Last Saved:</span>
                    <span className="value">{formatLastSaved}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Auto-save:</span>
                    <span className={`value ${fileOps.autoSaveEnabled ? 'enabled' : 'disabled'}`}>
                      {fileOps.autoSaveEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="button-group">
                  <button
                    className="file-btn primary"
                    onClick={handleSave}
                    disabled={fileOps.isSaving}
                  >
                    <Save size={16} />
                    Save Now
                  </button>
                  <button
                    className="file-btn"
                    onClick={handleBackup}
                    title="Create backup"
                  >
                    <Clock size={16} />
                    Backup
                  </button>
                </div>

                <div className="export-section">
                  <h4>Export As</h4>
                  <div className="button-group">
                    <button
                      className="file-btn"
                      onClick={() => handleExport('json')}
                    >
                      <Download size={16} />
                      JSON
                    </button>
                    <button
                      className="file-btn"
                      onClick={() => handleExport('xml')}
                    >
                      <Download size={16} />
                      XML
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No file loaded</p>
                <p className="hint">Create a new file or open an existing one</p>
              </div>
            )}
          </div>
        )}

        {/* Open File */}
        {activeTab === 'open' && (
          <div className="tab-pane">
            {files.length > 0 ? (
              <div className="file-list">
                {files.map(filename => (
                  <div key={filename} className="file-item">
                    <div className="file-name">{filename}</div>
                    <div className="file-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleOpenFile(filename)}
                        title="Open file"
                      >
                        Open
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteFile(filename)}
                        title="Delete file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No saved files</p>
                <p className="hint">Create a new file to get started</p>
              </div>
            )}
          </div>
        )}

        {/* New File */}
        {activeTab === 'new' && (
          <div className="tab-pane">
            <div className="new-file-form">
              <label htmlFor="new-filename">Filename:</label>
              <input
                id="new-filename"
                type="text"
                value={newFilename}
                onChange={e => setNewFilename(e.target.value)}
                placeholder="Enter filename..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleNewFile();
                }}
              />
              <button
                className="file-btn primary"
                onClick={handleNewFile}
                disabled={fileOps.isLoading}
              >
                <Plus size={16} />
                Create
              </button>
            </div>

            <div className="import-section">
              <h4>Import File</h4>
              <button
                className="file-btn"
                onClick={handleImportFile}
                disabled={fileOps.isLoading}
              >
                <Upload size={16} />
                Import from Disk
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".drawio.json,.json"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
              <p className="hint">Select a .drawio.json file to import</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
