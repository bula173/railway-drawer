/**
 * @file MaxGraphFileDialog.tsx
 * @brief File dialog for maxGraph save/load/import/export
 *
 * Handles .drawio files and localStorage persistence
 */

import React, { useState, useEffect } from 'react';
import {
  exportAsDrawioXml,
  listLocalFiles,
  deleteFileFromLocalStorage,
  downloadDrawioFile,
  importDrawioFile,
  createDrawioFile,
  saveFileToLocalStorage,
  applyDrawioFileToGraph,
  type DrawioFile,
} from '../utils/maxGraphFileOps';
import { Graph } from '@maxgraph/core';
import { logger } from '../utils/logger';
import './styles/maxGraphFileDialog.css';

interface MaxGraphFileDialogProps {
  graph: Graph;
  isOpen: boolean;
  onClose: () => void;
  currentFileName?: string;
  onFileLoad?: (file: DrawioFile) => void;
}

export const MaxGraphFileDialog: React.FC<MaxGraphFileDialogProps> = ({
  graph,
  isOpen,
  onClose,
  currentFileName = 'Untitled',
  onFileLoad,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'open' | 'new'>('current');
  const [files, setFiles] = useState<Array<{ key: string; file: DrawioFile }>>([]);
  const [newFileName, setNewFileName] = useState(currentFileName);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshFileList();
    }
  }, [isOpen]);

  const refreshFileList = (): void => {
    const allFiles = listLocalFiles();
    setFiles(allFiles);
  };

  const handleSaveCurrent = (): void => {
    try {
      const file = createDrawioFile(graph, currentFileName);
      const key = `railway_${Date.now()}`;
      saveFileToLocalStorage(file, key);
      refreshFileList();
      logger.debug('MaxGraphFileDialog', 'File saved', { filename: currentFileName });
    } catch (error) {
      logger.error('MaxGraphFileDialog', 'Failed to save file', { error });
    }
  };

  const handleExportXml = (): void => {
    try {
      const xml = exportAsDrawioXml(graph);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentFileName}.drawio`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      logger.debug('MaxGraphFileDialog', 'File exported', { filename: link.download });
    } catch (error) {
      logger.error('MaxGraphFileDialog', 'Failed to export file', { error });
    }
  };

  const handleLoadFile = (file: DrawioFile): void => {
    try {
      applyDrawioFileToGraph(graph, file);
      onFileLoad?.(file);
      onClose();
      logger.debug('MaxGraphFileDialog', 'File loaded', { filename: file.name });
    } catch (error) {
      logger.error('MaxGraphFileDialog', 'Failed to load file', { error });
    }
  };

  const handleDeleteFile = (key: string): void => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteFileFromLocalStorage(key);
      refreshFileList();
      logger.debug('MaxGraphFileDialog', 'File deleted', { key });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const drawioFile = await importDrawioFile(file);
      if (drawioFile) {
        const key = `railway_${Date.now()}`;
        saveFileToLocalStorage(drawioFile, key);
        refreshFileList();
        logger.debug('MaxGraphFileDialog', 'File imported', { filename: file.name });
      }
    } catch (error) {
      logger.error('MaxGraphFileDialog', 'Failed to import file', { error });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="maxgraph-file-dialog-overlay" onClick={onClose}>
      <div className="maxgraph-file-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>File Operations</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'current' ? 'active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            Current
          </button>
          <button
            className={`tab ${activeTab === 'open' ? 'active' : ''}`}
            onClick={() => setActiveTab('open')}
          >
            Open
          </button>
          <button
            className={`tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            New
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'current' && (
            <div className="current-tab">
              <h3>Current File</h3>
              <p>Name: <strong>{currentFileName}</strong></p>
              <div className="actions">
                <button onClick={handleSaveCurrent} className="btn btn-primary">
                  Save to Storage
                </button>
                <button onClick={handleExportXml} className="btn btn-secondary">
                  Export as .drawio
                </button>
              </div>
            </div>
          )}

          {activeTab === 'open' && (
            <div className="open-tab">
              <h3>Saved Files</h3>
              {files.length === 0 ? (
                <p className="empty-message">No files saved yet</p>
              ) : (
                <div className="file-list">
                  {files.map(({ key, file }) => (
                    <div key={key} className="file-item">
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-meta">
                          Modified: {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      <div className="file-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleLoadFile(file)}
                        >
                          Load
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteFile(key)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'new' && (
            <div className="new-tab">
              <h3>Import File</h3>
              <label className="file-upload">
                <input
                  type="file"
                  accept=".drawio,.xml"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
                <span className="upload-label">Click to select a .drawio file</span>
              </label>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

MaxGraphFileDialog.displayName = 'MaxGraphFileDialog';
