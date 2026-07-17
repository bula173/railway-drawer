/**
 * @file drawioFileOps.ts
 * @brief Draw.io file import/export operations
 *
 * Handles:
 * - Loading .drawio files
 * - Saving to .drawio format
 * - File versioning
 * - Auto-save functionality
 */

import { logger } from './logger';

export interface DrawioFile {
  version: string;
  filename: string;
  xml: string;
  metadata: {
    created: number;
    modified: number;
    author?: string;
    description?: string;
  };
}

export interface DrawioFileMetadata {
  version: string;
  created: number;
  modified: number;
  author?: string;
  description?: string;
}

const CURRENT_VERSION = '1.0';
const STORAGE_KEY_PREFIX = 'railway_drawer_file_';

/**
 * Create a new draw.io file structure
 */
export function createNewDrawioFile(
  filename: string,
  xml: string = '',
  metadata?: Partial<DrawioFileMetadata>
): DrawioFile {
  const now = Date.now();
  return {
    version: CURRENT_VERSION,
    filename,
    xml,
    metadata: {
      created: now,
      modified: now,
      author: 'Railway Drawer',
      ...metadata,
    },
  };
}

/**
 * Convert draw.io file to JSON string
 */
export function serializeDrawioFile(file: DrawioFile): string {
  try {
    return JSON.stringify(file, null, 2);
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to serialize file', { error });
    throw error;
  }
}

/**
 * Parse draw.io file from JSON string
 */
export function deserializeDrawioFile(jsonString: string): DrawioFile {
  try {
    const data = JSON.parse(jsonString);

    if (!data.version || !data.filename || !data.xml) {
      throw new Error('Invalid draw.io file format');
    }

    return data as DrawioFile;
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to deserialize file', { error });
    throw error;
  }
}

/**
 * Export file as .drawio JSON file (download)
 */
export function downloadDrawioFile(file: DrawioFile): void {
  try {
    const jsonString = serializeDrawioFile(file);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.filename}.drawio.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('drawioFileOps', 'File downloaded', {
      filename: file.filename,
    });
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to download file', { error });
    throw error;
  }
}

/**
 * Export file as native .drawio XML
 */
export function downloadDrawioXml(filename: string, xml: string): void {
  try {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.drawio`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('drawioFileOps', 'XML file downloaded', { filename });
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to download XML', { error });
    throw error;
  }
}

/**
 * Load file from disk (via file input)
 */
export async function loadDrawioFile(file: File): Promise<DrawioFile> {
  try {
    const content = await file.text();
    const drawioFile = deserializeDrawioFile(content);

    logger.info('drawioFileOps', 'File loaded', {
      filename: drawioFile.filename,
      version: drawioFile.version,
    });

    return drawioFile;
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to load file', { error });
    throw error;
  }
}

/**
 * Save file to localStorage (auto-save)
 */
export function saveToLocalStorage(file: DrawioFile): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${file.filename}`;
    const serialized = serializeDrawioFile(file);
    localStorage.setItem(key, serialized);

    logger.debug('drawioFileOps', 'File saved to localStorage', {
      filename: file.filename,
      size: serialized.length,
    });
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to save to localStorage', { error });
    throw error;
  }
}

/**
 * Load file from localStorage
 */
export function loadFromLocalStorage(filename: string): DrawioFile | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${filename}`;
    const serialized = localStorage.getItem(key);

    if (!serialized) {
      return null;
    }

    const file = deserializeDrawioFile(serialized);
    logger.debug('drawioFileOps', 'File loaded from localStorage', {
      filename,
    });

    return file;
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to load from localStorage', { error });
    return null;
  }
}

/**
 * List all saved files from localStorage
 */
export function listLocalStorageFiles(): string[] {
  try {
    const files: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const filename = key.substring(STORAGE_KEY_PREFIX.length);
        files.push(filename);
      }
    }

    logger.debug('drawioFileOps', 'Listed localStorage files', {
      count: files.length,
    });

    return files;
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to list files', { error });
    return [];
  }
}

/**
 * Delete file from localStorage
 */
export function deleteFromLocalStorage(filename: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${filename}`;
    localStorage.removeItem(key);

    logger.debug('drawioFileOps', 'File deleted from localStorage', {
      filename,
    });
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to delete file', { error });
  }
}

/**
 * Export as native draw.io format (mxGraph XML)
 */
export function exportAsNativeDrawio(filename: string, xml: string): void {
  try {
    // Wrap XML in draw.io format
    const drawioXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Railway Drawer" modified="${Date.now()}" agent="Railway Drawer">
  <diagram name="Page-1">
    <mxGraphModel>
      ${xml}
    </mxGraphModel>
  </diagram>
</mxfile>`;

    downloadDrawioXml(filename, drawioXml);
  } catch (error) {
    logger.error('drawioFileOps', 'Failed to export as native drawio', { error });
    throw error;
  }
}

/**
 * Create backup of file
 */
export function createBackup(file: DrawioFile): DrawioFile {
  const backup = {
    ...file,
    filename: `${file.filename}.backup.${Date.now()}`,
    metadata: {
      ...file.metadata,
      modified: Date.now(),
    },
  };

  saveToLocalStorage(backup);
  logger.info('drawioFileOps', 'Backup created', {
    original: file.filename,
    backup: backup.filename,
  });

  return backup;
}

/**
 * Restore from backup
 */
export function restoreFromBackup(backupFilename: string): DrawioFile | null {
  const file = loadFromLocalStorage(backupFilename);
  if (file) {
    logger.info('drawioFileOps', 'Backup restored', {
      filename: file.filename,
    });
  }
  return file;
}

/**
 * Get file size information
 */
export function getFileSizeInfo(file: DrawioFile): {
  totalBytes: number;
  totalKB: number;
  xmlBytes: number;
  xmlKB: number;
} {
  const serialized = serializeDrawioFile(file);
  const totalBytes = new Blob([serialized]).size;

  const xmlBytes = new Blob([file.xml]).size;

  return {
    totalBytes,
    totalKB: Math.round(totalBytes / 1024),
    xmlBytes,
    xmlKB: Math.round(xmlBytes / 1024),
  };
}

/**
 * Validate file before operations
 */
export function validateDrawioFile(file: DrawioFile): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!file.filename || typeof file.filename !== 'string') {
    errors.push('Invalid filename');
  }

  if (!file.xml || typeof file.xml !== 'string') {
    errors.push('Invalid XML content');
  }

  if (!file.version) {
    errors.push('Missing version');
  }

  if (!file.metadata) {
    errors.push('Missing metadata');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
