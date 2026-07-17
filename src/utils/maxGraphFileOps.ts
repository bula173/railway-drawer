/**
 * @file maxGraphFileOps.ts
 * @brief File operations for maxGraph (save/load/import/export)
 *
 * Handles .drawio format and localStorage persistence
 */

import { Graph } from '@maxgraph/core';
import { serializeGraph, deserializeGraph } from './maxGraphUtils';
import { logger } from './logger';

export interface DrawioFile {
  version: string;
  name: string;
  created: number;
  modified: number;
  author?: string;
  xml: string;
  metadata: Record<string, any>;
}

/**
 * Export graph as .drawio XML format
 */
export function exportAsDrawioXml(graph: Graph): string {
  try {
    // Create mxFile structure
    const model = graph.getModel();
    const root = model.getRoot();

    // For now, use a simplified XML structure
    // In production, use maxGraph's native codec
    const serialized = serializeGraph(graph);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile version="1.0" type="device" modified="${new Date().toISOString()}">
  <diagram name="Page 1">
    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
      <diagram_data>
        ${JSON.stringify(serialized)}
      </diagram_data>
    </mxGraphModel>
  </diagram>
</mxfile>`;

    return xml;
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to export XML', { error });
    return '';
  }
}

/**
 * Create a DrawioFile from graph
 */
export function createDrawioFile(
  graph: Graph,
  name: string,
  author?: string
): DrawioFile {
  return {
    version: '1.0',
    name,
    created: Date.now(),
    modified: Date.now(),
    author,
    xml: exportAsDrawioXml(graph),
    metadata: {
      vertices: graph.getModel().getRoot()?.getChildCount() || 0,
    },
  };
}

/**
 * Save file to localStorage
 */
export function saveFileToLocalStorage(file: DrawioFile, key: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(file));
    logger.debug('maxGraphFileOps', 'File saved to localStorage', { key });
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to save to localStorage', { error });
    throw new Error('Failed to save file to localStorage');
  }
}

/**
 * Load file from localStorage
 */
export function loadFileFromLocalStorage(key: string): DrawioFile | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    return JSON.parse(data) as DrawioFile;
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to load from localStorage', { error });
    return null;
  }
}

/**
 * List all files in localStorage
 */
export function listLocalFiles(): Array<{ key: string; file: DrawioFile }> {
  const files: Array<{ key: string; file: DrawioFile }> = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('railway_')) continue;

      const data = localStorage.getItem(key);
      if (!data) continue;

      try {
        const file = JSON.parse(data) as DrawioFile;
        files.push({ key, file });
      } catch {
        // Skip invalid files
      }
    }
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to list files', { error });
  }

  return files;
}

/**
 * Delete file from localStorage
 */
export function deleteFileFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
    logger.debug('maxGraphFileOps', 'File deleted from localStorage', { key });
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to delete file', { error });
  }
}

/**
 * Download file as .drawio
 */
export function downloadDrawioFile(file: DrawioFile): void {
  try {
    const blob = new Blob([file.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name}.drawio`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.debug('maxGraphFileOps', 'File downloaded', { filename: link.download });
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to download file', { error });
  }
}

/**
 * Import .drawio file
 */
export async function importDrawioFile(file: File): Promise<DrawioFile | null> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML file');
    }

    return {
      version: '1.0',
      name: file.name.replace('.drawio', ''),
      created: Date.now(),
      modified: Date.now(),
      xml: text,
      metadata: {
        imported: true,
        originalFile: file.name,
      },
    };
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to import file', { error });
    return null;
  }
}

/**
 * Apply DrawioFile to graph
 */
export function applyDrawioFileToGraph(graph: Graph, file: DrawioFile): void {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(file.xml, 'text/xml');

    // Extract diagram data
    const diagramData = doc.querySelector('diagram_data');
    if (diagramData?.textContent) {
      const data = JSON.parse(diagramData.textContent);
      deserializeGraph(graph, data);
      logger.debug('maxGraphFileOps', 'File applied to graph', { name: file.name });
    }
  } catch (error) {
    logger.error('maxGraphFileOps', 'Failed to apply file to graph', { error });
  }
}

/**
 * Create a backup of current graph state
 */
export function createBackup(file: DrawioFile): string {
  const backup: DrawioFile = {
    ...file,
    name: `${file.name} (backup ${new Date().toLocaleString()})`,
  };
  const key = `railway_backup_${Date.now()}`;
  saveFileToLocalStorage(backup, key);
  return key;
}

/**
 * Get file size info
 */
export function getFileSizeInfo(file: DrawioFile) {
  const xmlSize = new Blob([file.xml]).size;
  const jsonSize = new Blob([JSON.stringify(file)]).size;

  return {
    xmlBytes: xmlSize,
    jsonBytes: jsonSize,
    xmlKb: (xmlSize / 1024).toFixed(2),
    jsonKb: (jsonSize / 1024).toFixed(2),
  };
}
