/**
 * @file MxGraphEditorWithFiles.tsx
 * @brief Complete mxGraph editor with file operations integrated
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { MxGraphEditorPanel } from './MxGraphEditorPanel';
import { FileToolbar } from './FileToolbar';
import { useMxGraphShapes } from '../hooks/useMxGraphShapes';
import { useDrawioFileOps } from '../hooks/useDrawioFileOps';
import type { MxGraphEditorRef } from './MxGraphEditor';
import { logger } from '../utils/logger';
import './styles/mxgraphEditorWithFiles.css';

export interface MxGraphEditorWithFilesProps {
  initialFilename?: string;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

/**
 * Complete mxGraph editor with file operations
 */
export const MxGraphEditorWithFiles: React.FC<MxGraphEditorWithFilesProps> = ({
  initialFilename = 'Untitled',
  enableAutoSave = true,
  autoSaveInterval = 30000,
}) => {
  const editorRef = useRef<MxGraphEditorRef>(null);
  const { shapes, isLoading: shapesLoading } = useMxGraphShapes();
  const fileOps = useDrawioFileOps({
    filename: initialFilename,
    enableAutoSave,
    autoSaveInterval,
  });

  // Load initial file if exists
  useEffect(() => {
    const loadInitial = async () => {
      try {
        await fileOps.loadFile(initialFilename);
      } catch (error) {
        logger.debug('MxGraphEditorWithFiles', 'No initial file found, creating new', {
          filename: initialFilename,
        });
        fileOps.createNewFile(initialFilename);
      }
    };

    loadInitial();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'o') {
        e.preventDefault();
        // Would trigger file dialog, but it's handled in FileToolbar
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileOps]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !fileOps.file) return;

    try {
      const xml = editorRef.current.getXml();
      await fileOps.saveFile(xml);
      logger.info('MxGraphEditorWithFiles', 'File saved via keyboard shortcut');
    } catch (error) {
      logger.error('MxGraphEditorWithFiles', 'Failed to save', { error });
    }
  }, [fileOps]);

  return (
    <div className="mxgraph-editor-with-files">
      {/* File Toolbar */}
      <FileToolbar fileOps={fileOps} onSave={handleSave} />

      {/* Editor Panel */}
      <MxGraphEditorPanel
        ref={editorRef}
        initialXml={fileOps.file?.xml}
        onSave={handleSave}
        items={shapes}
      />

      {/* Loading indicator */}
      {shapesLoading && (
        <div className="loading-overlay">
          <span>Loading shapes...</span>
        </div>
      )}
    </div>
  );
};
