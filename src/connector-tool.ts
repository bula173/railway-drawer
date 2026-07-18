/**
 * Connector Tool
 * Handles creating connections between shapes
 */

export interface ConnectorStyle {
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  endArrow: 'classic' | 'block' | 'open' | 'none';
  startArrow: 'classic' | 'block' | 'open' | 'none';
}

export class ConnectorTool {
  private isDrawing = false;
  private startCell: any = null;
  private startPoint: [number, number] | null = null;

  constructor(private graph: any) {}

  startConnection(cell: any, _x: number, _y: number): void {
    if (!cell) return;
    this.isDrawing = true;
    this.startCell = cell;
    this.startPoint = [_x, _y];
  }

  endConnection(endCell: any, _x: number, _y: number): void {
    if (!this.isDrawing || !this.startCell || !this.startPoint) return;

    // Prevent self-connections
    if (endCell && endCell === this.startCell) {
      this.resetConnection();
      return;
    }

    if (endCell) {
      this.createConnection(this.startCell, endCell);
    }

    this.resetConnection();
  }

  resetConnection(): void {
    this.isDrawing = false;
    this.startCell = null;
    this.startPoint = null;
  }

  private createConnection(sourceCell: any, targetCell: any, style?: Partial<ConnectorStyle>): any {
    const defaultStyle: ConnectorStyle = {
      strokeColor: '#000000',
      strokeWidth: 1,
      strokeStyle: 'solid',
      endArrow: 'classic',
      startArrow: 'none',
    };

    const connectorStyle = { ...defaultStyle, ...style };

    const edge = this.graph.insertEdge({
      source: sourceCell,
      target: targetCell,
      value: '', // Edge label
      style: {
        strokeColor: connectorStyle.strokeColor,
        strokeWidth: connectorStyle.strokeWidth,
        dashed: connectorStyle.strokeStyle === 'dashed' ? 1 : 0,
        dotted: connectorStyle.strokeStyle === 'dotted' ? 1 : 0,
        endArrow: connectorStyle.endArrow === 'none' ? 0 : connectorStyle.endArrow,
        startArrow: connectorStyle.startArrow === 'none' ? 0 : connectorStyle.startArrow,
        rounded: 1,
        edgeStyle: 'orthogonalEdgeStyle',
      },
    });

    return edge;
  }

  isDrawingConnection(): boolean {
    return this.isDrawing;
  }

  getStartCell(): any {
    return this.startCell;
  }

  getStartPoint(): [number, number] | null {
    return this.startPoint;
  }

  // Update connector properties
  updateConnectorStyle(edge: any, style: Partial<ConnectorStyle>): void {
    const currentStyle = edge.style || {};

    const newStyle = {
      ...currentStyle,
      strokeColor: style.strokeColor || currentStyle.strokeColor,
      strokeWidth: style.strokeWidth !== undefined ? style.strokeWidth : currentStyle.strokeWidth,
      dashed: style.strokeStyle === 'dashed' ? 1 : currentStyle.dashed,
      dotted: style.strokeStyle === 'dotted' ? 1 : currentStyle.dotted,
      endArrow: style.endArrow !== 'none' ? style.endArrow : 0,
      startArrow: style.startArrow !== 'none' ? style.startArrow : 0,
    };

    this.graph.setCellStyles(edge, newStyle);
  }

  setConnectorLabel(edge: any, label: string): void {
    this.graph.model.setValue(edge, label);
  }
}
