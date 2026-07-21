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
    const project = document.createElement('project');
    project.setAttribute('name', this.projectMetadata.name);
    project.setAttribute('version', this.projectMetadata.version);
    project.setAttribute('createdAt', this.projectMetadata.createdAt);
    project.setAttribute('modifiedAt', this.projectMetadata.modifiedAt);

    const diagram = document.createElement('diagram');
    diagram.setAttribute('name', 'Sheet1');

    const graphModel = new DOMParser().parseFromString(graphXml, 'text/xml');
    diagram.appendChild(graphModel.documentElement.cloneNode(true));

    project.appendChild(diagram);

    return new XMLSerializer().serializeToString(project);
  }

  parseProjectXml(xml: string): { metadata: ProjectMetadata; graphXml: string } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const projectEl = doc.documentElement;
    const metadata: ProjectMetadata = {
      name: projectEl.getAttribute('name') || 'Untitled Diagram',
      version: projectEl.getAttribute('version') || '1.0',
      createdAt: projectEl.getAttribute('createdAt') || new Date().toISOString(),
      modifiedAt: projectEl.getAttribute('modifiedAt') || new Date().toISOString(),
    };

    const diagramEl = projectEl.getElementsByTagName('diagram')[0];
    let graphXml = '<mxGraphModel><root></root></mxGraphModel>';

    if (diagramEl) {
      const mxGraphModel = diagramEl.getElementsByTagName('mxGraphModel')[0];
      if (mxGraphModel) {
        graphXml = new XMLSerializer().serializeToString(mxGraphModel);
      }
    }

    return { metadata, graphXml };
  }

  exportToFile(projectXml: string, filename: string): void {
    const blob = new Blob([projectXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${this.projectMetadata.name}.drawio`;
    link.click();
    URL.revokeObjectURL(url);
    console.log('[Project] Exported to file:', filename);
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
