/**
 * @file useDrawioFileOps.ts
 * @brief Hook for draw.io file operations and auto-save
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { logger } from '../utils/logger';
import {
  createNewDrawioFile,
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadDrawioFile,
  downloadDrawioXml,
  listLocalStorageFiles,
  deleteFromLocalStorage,
  validateDrawioFile,
  createBackup,
  type DrawioFile,
} from '../utils/drawioFileOps';

interface UseDrawioFileOpsOptions {
  autoSaveInterval?: number; // milliseconds
  filename?: string;
  enableAutoSave?: boolean;
}

export interface UseDrawioFileOpsResult {
  file: DrawioFile | null;
  filename: string;
  isLoading: boolean;
  isSaving: boolean;
  autoSaveEnabled: boolean;
  lastSaved: number | null;

  // File operations
  createNewFile: (name: string, xml?: string) => DrawioFile;
  saveFile: (xml: string) => Promise<void>;
  loadFile: (filename: string) => Promise<void>;
  downloadFile: (format: 'json' | 'xml') => void;
  loadFileFromDisk: (file: File) => Promise<void>;
  deleteFile: (filename: string) => void;
  listFiles: () => string[];

  // Auto-save
  toggleAutoSave: () => void;
  createBackupNow: () => void;

  // State
  setFilename: (name: string) => void;
}

const DEFAULT_AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Hook for draw.io file operations
 */
export function useDrawioFileOps(options: UseDrawioFileOpsOptions = {}): UseDrawioFileOpsResult {
  const {
    autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
    filename: initialFilename = 'Untitled',
    enableAutoSave = true,
  } = options;

  const [file, setFile] = useState<DrawioFile | null>(null);
  const [filename, setFilename] = useState(initialFilename);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(enableAutoSave);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingXmlRef = useRef<string | null>(null);

  // Auto-save effect
  useEffect(() => {
    if (!autoSaveEnabled || !file) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      return;
    }

    autoSaveTimerRef.current = setInterval(() => {
      if (pendingXmlRef.current && file) {
        logger.debug('useDrawioFileOps', 'Auto-saving file', { filename: file.filename });
        saveToLocalStorage(file);
        setLastSaved(Date.now());
        pendingXmlRef.current = null;
      }
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, file, autoSaveInterval]);

  const createNewFile = useCallback(
    (name: string, xml: string = ''): DrawioFile => {
      const newFile = createNewDrawioFile(name, xml);
      setFile(newFile);
      setFilename(name);
      return newFile;
    },
    []
  );

  const saveFile = useCallback(
    async (xml: string) => {
      try {
        setIsSaving(true);

        if (!file) {
          throw new Error('No file loaded');
        }

        const updatedFile = {
          ...file,
          xml,
          metadata: {
            ...file.metadata,
            modified: Date.now(),
          },
        };

        // Validate before saving
        const validation = validateDrawioFile(updatedFile);
        if (!validation.valid) {
          throw new Error(`Invalid file: ${validation.errors.join(', ')}`);
        }

        saveToLocalStorage(updatedFile);
        setFile(updatedFile);
        setLastSaved(Date.now());
        pendingXmlRef.current = null;

        logger.info('useDrawioFileOps', 'File saved', {
          filename: updatedFile.filename,
          size: updatedFile.xml.length,
        });
      } catch (error) {
        logger.error('useDrawioFileOps', 'Failed to save file', { error });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [file]
  );

  const loadFile = useCallback(async (name: string) => {
    try {
      setIsLoading(true);

      const loadedFile = loadFromLocalStorage(name);
      if (!loadedFile) {
        throw new Error(`File not found: ${name}`);
      }

      setFile(loadedFile);
      setFilename(loadedFile.filename);
      setLastSaved(loadedFile.metadata.modified);

      logger.info('useDrawioFileOps', 'File loaded', {
        filename: loadedFile.filename,
      });
    } catch (error) {
      logger.error('useDrawioFileOps', 'Failed to load file', { error });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadFile = useCallback(
    (format: 'json' | 'xml') => {
      if (!file) {
        logger.warn('useDrawioFileOps', 'No file to download');
        return;
      }

      if (format === 'json') {
        downloadDrawioFile(file);
      } else {
        downloadDrawioXml(file.filename, file.xml);
      }
    },
    [file]
  );

  const loadFileFromDisk = useCallback(
    async (diskFile: File) => {
      try {
        setIsLoading(true);

        const text = await diskFile.text();
        const loadedFile = JSON.parse(text) as DrawioFile;

        setFile(loadedFile);
        setFilename(loadedFile.filename);

        logger.info('useDrawioFileOps', 'File imported from disk', {
          filename: loadedFile.filename,
        });
      } catch (error) {
        logger.error('useDrawioFileOps', 'Failed to load file from disk', { error });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteFile = useCallback((name: string) => {
    deleteFromLocalStorage(name);
    if (file?.filename === name) {
      setFile(null);
    }
    logger.info('useDrawioFileOps', 'File deleted', { filename: name });
  }, [file]);

  const listFiles = useCallback(() => {
    return listLocalStorageFiles();
  }, []);

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled(prev => !prev);
  }, []);

  const createBackupNow = useCallback(() => {
    if (!file) {
      logger.warn('useDrawioFileOps', 'No file to backup');
      return;
    }

    createBackup(file);
  }, [file]);

  return {
    file,
    filename,
    isLoading,
    isSaving,
    autoSaveEnabled,
    lastSaved,
    createNewFile,
    saveFile,
    loadFile,
    downloadFile,
    loadFileFromDisk,
    deleteFile,
    listFiles,
    toggleAutoSave,
    createBackupNow,
    setFilename,
  };
}
