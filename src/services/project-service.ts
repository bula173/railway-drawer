export interface ProjectMetadata {
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
}

export class ProjectService {
  private projectMetadata: ProjectMetadata = {
    name: 'Untitled Diagram',
    version: '1.0',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  setProjectName(name: string): void {
    this.projectMetadata.name = name;
    this.projectMetadata.modifiedAt = new Date().toISOString();
  }

  getProjectName(): string {
    return this.projectMetadata.name;
  }

  getProjectMetadata(): ProjectMetadata {
    return { ...this.projectMetadata };
  }

  serializeGraphToXml(graph: any): string {
    try {
      const model = graph.model;
      const encoder = (graph as any).getModelEncoder ? (graph as any).getModelEncoder() : null;

      if (encoder) {
        const node = encoder.encode(model);
        const xml = new XMLSerializer().serializeToString(node);
        return xml;
      }

      // Fallback: create basic XML structure
      const root = document.createElement('mxGraphModel');
      root.setAttribute('dx', '0');
      root.setAttribute('dy', '0');
      root.setAttribute('grid', '1');
      root.setAttribute('gridSize', String(graph.gridSize));
      root.setAttribute('guides', '1');
      root.setAttribute('tooltips', '1');
      root.setAttribute('connect', '1');
      root.setAttribute('arrows', '1');
      root.setAttribute('fold', '1');
      root.setAttribute('page', '1');
      root.setAttribute('pageScale', '1');
      root.setAttribute('pageWidth', '850');
      root.setAttribute('pageHeight', '1100');
      root.setAttribute('math', '0');
      root.setAttribute('shadow', '0');

      const mxRoot = document.createElement('root');
      const mxDefaultParent = document.createElement('mxCell');
      mxDefaultParent.setAttribute('id', '0');

      const mxDefaultParent2 = document.createElement('mxCell');
      mxDefaultParent2.setAttribute('id', '1');
      mxDefaultParent2.setAttribute('parent', '0');

      mxRoot.appendChild(mxDefaultParent);
      mxRoot.appendChild(mxDefaultParent2);

      // Add all cells
      const allCells = model.cells;
      if (allCells) {
        for (const key in allCells) {
          if (allCells.hasOwnProperty(key)) {
            const cell = allCells[key];
            if (cell && cell.id !== '0' && cell.id !== '1') {
              const cellXml = this.serializeCellToXml(cell);
              if (cellXml) {
                mxRoot.appendChild(cellXml);
              }
            }
          }
        }
      }

      root.appendChild(mxRoot);
      return new XMLSerializer().serializeToString(root);
    } catch (error) {
      console.error('[Project] Failed to serialize graph:', error);
      return '<mxGraphModel><root></root></mxGraphModel>';
    }
  }

  private serializeCellToXml(cell: any): Element | null {
    try {
      const mxCell = document.createElement('mxCell');
      mxCell.setAttribute('id', cell.id || '');

      if (cell.value !== undefined && cell.value !== null) {
        mxCell.setAttribute('value', String(cell.value));
      }

      if (cell.style) {
        mxCell.setAttribute('style', cell.style);
      }

      if (cell.parent) {
        mxCell.setAttribute('parent', cell.parent.id || '1');
      }

      if (cell.vertex) {
        mxCell.setAttribute('vertex', '1');
      }

      if (cell.edge) {
        mxCell.setAttribute('edge', '1');
      }

      const geometry = cell.getGeometry?.();
      if (geometry) {
        const mxGeometry = document.createElement('mxGeometry');
        mxGeometry.setAttribute('x', String(Math.round(geometry.x)));
        mxGeometry.setAttribute('y', String(Math.round(geometry.y)));
        mxGeometry.setAttribute('width', String(Math.round(geometry.width)));
        mxGeometry.setAttribute('height', String(Math.round(geometry.height)));
        mxGeometry.setAttribute('as', 'geometry');

        if (geometry.relative) {
          mxGeometry.setAttribute('relative', '1');
        }

        mxCell.appendChild(mxGeometry);
      }

      return mxCell;
    } catch (error) {
      console.error('[Project] Failed to serialize cell:', error);
      return null;
    }
  }

  deserializeGraphFromXml(graph: any, xml: string): void {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML');
      }

      const model = graph.model as any;
      model.clear();

      const root = doc.documentElement;
      const mxRoot = root.getElementsByTagName('root')[0];

      if (!mxRoot) {
        console.warn('[Project] No root element found in XML');
        return;
      }

      const cells = mxRoot.getElementsByTagName('mxCell');
      model.batchUpdate(() => {
        for (let i = 0; i < cells.length; i++) {
          const cellElement = cells[i];
          const id = cellElement.getAttribute('id');
          const value = cellElement.getAttribute('value') || '';
          const styleStr = cellElement.getAttribute('style') || '';
          const isVertex = cellElement.getAttribute('vertex') === '1';
          const isEdge = cellElement.getAttribute('edge') === '1';

          const geometry = cellElement.getElementsByTagName('mxGeometry')[0];
          let x = 0,
            y = 0,
            width = 80,
            height = 60;

          if (geometry) {
            x = parseFloat(geometry.getAttribute('x') || '0');
            y = parseFloat(geometry.getAttribute('y') || '0');
            width = parseFloat(geometry.getAttribute('width') || '80');
            height = parseFloat(geometry.getAttribute('height') || '60');
          }

          if (isVertex) {
            const cell = graph.insertVertex(
              graph.getDefaultParent(),
              id,
              value,
              x,
              y,
              width,
              height,
              styleStr as any
            );
            if (cell && styleStr) {
              cell.style = styleStr;
            }
          } else if (isEdge) {
            // Handle edges if present
            const source = cellElement.getAttribute('source');
            const target = cellElement.getAttribute('target');
            if (source && target) {
              graph.insertEdge(graph.getDefaultParent(), id, value, source, target);
            }
          }
        }
      });

      graph.refresh();
      console.log('[Project] Loaded graph from XML');
    } catch (error) {
      console.error('[Project] Failed to deserialize graph:', error);
    }
  }

  generateProjectXml(graphXml: string): string {
    // Create mxfile element (standard draw.io format)
    const mxfile = document.createElement('mxfile');
    mxfile.setAttribute('host', 'railway-drawer');
    mxfile.setAttribute('modified', this.projectMetadata.modifiedAt);
    mxfile.setAttribute('agent', 'railway-drawer/1.0');
    mxfile.setAttribute('version', this.projectMetadata.version);

    const diagram = document.createElement('diagram');
    diagram.setAttribute('id', '1');
    diagram.setAttribute('name', this.projectMetadata.name);

    try {
      // Parse the graph XML and add it to the diagram
      const graphModel = new DOMParser().parseFromString(graphXml, 'text/xml');
      if (graphModel.documentElement) {
        diagram.appendChild(graphModel.documentElement.cloneNode(true));
      }
    } catch (error) {
      console.error('[Project] Error parsing graph XML:', error);
      // Create empty mxGraphModel if parsing fails
      const emptyModel = document.createElement('mxGraphModel');
      emptyModel.setAttribute('dx', '0');
      emptyModel.setAttribute('dy', '0');
      emptyModel.setAttribute('grid', '1');
      emptyModel.setAttribute('gridSize', '10');
      emptyModel.setAttribute('guides', '1');
      emptyModel.setAttribute('tooltips', '1');
      emptyModel.setAttribute('connect', '1');
      emptyModel.setAttribute('arrows', '1');
      emptyModel.setAttribute('fold', '1');
      emptyModel.setAttribute('page', '1');
      emptyModel.setAttribute('pageScale', '1');
      emptyModel.setAttribute('pageWidth', '827');
      emptyModel.setAttribute('pageHeight', '1169');
      emptyModel.setAttribute('background', '#ffffff');
      emptyModel.setAttribute('math', '0');
      emptyModel.setAttribute('shadow', '0');

      const root = document.createElement('root');
      const cell0 = document.createElement('mxCell');
      cell0.setAttribute('id', '0');
      const cell1 = document.createElement('mxCell');
      cell1.setAttribute('id', '1');
      cell1.setAttribute('parent', '0');
      cell1.setAttribute('edge', '1');

      root.appendChild(cell0);
      root.appendChild(cell1);
      emptyModel.appendChild(root);
      diagram.appendChild(emptyModel);
    }

    mxfile.appendChild(diagram);

    return new XMLSerializer().serializeToString(mxfile);
  }

  parseProjectXml(xml: string): { metadata: ProjectMetadata; graphXml: string } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML format');
    }

    const rootEl = doc.documentElement;
    let metadata: ProjectMetadata;
    let graphXml = '<mxGraphModel><root></root></mxGraphModel>';

    // Handle mxfile format (standard draw.io)
    if (rootEl.nodeName === 'mxfile') {
      const diagramEl = rootEl.getElementsByTagName('diagram')[0];
      if (diagramEl) {
        metadata = {
          name: diagramEl.getAttribute('name') || 'Untitled Diagram',
          version: rootEl.getAttribute('version') || '1.0',
          createdAt: new Date().toISOString(),
          modifiedAt: rootEl.getAttribute('modified') || new Date().toISOString(),
        };

        // Try mxGraphModel first
        let graphModel = diagramEl.getElementsByTagName('mxGraphModel')[0];
        // Then try GraphDataModel (maxGraph format)
        if (!graphModel) {
          graphModel = diagramEl.getElementsByTagName('GraphDataModel')[0];
        }

        if (graphModel) {
          graphXml = new XMLSerializer().serializeToString(graphModel);
        }
      } else {
        metadata = {
          name: 'Untitled Diagram',
          version: rootEl.getAttribute('version') || '1.0',
          createdAt: new Date().toISOString(),
          modifiedAt: rootEl.getAttribute('modified') || new Date().toISOString(),
        };
      }
    }
    // Handle legacy project format
    else if (rootEl.nodeName === 'project') {
      metadata = {
        name: rootEl.getAttribute('name') || 'Untitled Diagram',
        version: rootEl.getAttribute('version') || '1.0',
        createdAt: rootEl.getAttribute('createdAt') || new Date().toISOString(),
        modifiedAt: rootEl.getAttribute('modifiedAt') || new Date().toISOString(),
      };

      const diagramEl = rootEl.getElementsByTagName('diagram')[0];
      if (diagramEl) {
        let graphModel = diagramEl.getElementsByTagName('mxGraphModel')[0];
        if (!graphModel) {
          graphModel = diagramEl.getElementsByTagName('GraphDataModel')[0];
        }
        if (graphModel) {
          graphXml = new XMLSerializer().serializeToString(graphModel);
        }
      }
    } else {
      // Try to treat as mxGraphModel or GraphDataModel directly
      metadata = {
        name: 'Untitled Diagram',
        version: '1.0',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      graphXml = xml;
    }

    return { metadata, graphXml };
  }

  exportToFile(projectXml: string, filename: string): void {
    try {
      const blob = new Blob([projectXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${this.projectMetadata.name}.railwaydrawer`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      console.log('[Project] Exported to file:', filename);
    } catch (error) {
      console.error('[Project] Export failed:', error);
      throw error;
    }
  }

  importFromFile(file: File): Promise<{ metadata: ProjectMetadata; graphXml: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const xml = e.target?.result as string;
          const result = this.parseProjectXml(xml);
          this.projectMetadata = result.metadata;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
