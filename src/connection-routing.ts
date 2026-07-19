/**
 * Connection Routing Manager - Edge routing and styling
 */

export type RoutingStyle = 'straight' | 'curved' | 'orthogonal';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowType = 'none' | 'block' | 'open' | 'diamond' | 'circle';

export interface EdgeConfig {
  routing: RoutingStyle;
  style: EdgeStyle;
  startArrow: ArrowType;
  endArrow: ArrowType;
  strokeWidth: number;
  color: string;
}

export class ConnectionRoutingManager {
  private defaultConfig: EdgeConfig = {
    routing: 'straight',
    style: 'solid',
    startArrow: 'none',
    endArrow: 'block',
    strokeWidth: 2,
    color: '#000000',
  };

  constructor(private graph: any) {}

  /**
   * Set edge routing style
   */
  setEdgeRouting(edge: any, routing: RoutingStyle): void {
    const style = this.graph.getCellStyle(edge);
    style.edgeStyle = this.getEdgeStyleValue(routing);
    this.graph.setCellStyle(style, [edge]);
  }

  /**
   * Set edge line style (solid, dashed, dotted)
   */
  setEdgeLineStyle(edge: any, style: EdgeStyle): void {
    const cellStyle = this.graph.getCellStyle(edge);
    switch (style) {
      case 'solid':
        cellStyle.dashed = '0';
        cellStyle.dashPattern = undefined;
        break;
      case 'dashed':
        cellStyle.dashed = '1';
        cellStyle.dashPattern = '5 5';
        break;
      case 'dotted':
        cellStyle.dashed = '1';
        cellStyle.dashPattern = '2 3';
        break;
    }
    this.graph.setCellStyle(cellStyle, [edge]);
  }

  /**
   * Set arrow style
   */
  setArrowStyle(edge: any, position: 'start' | 'end', arrowType: ArrowType): void {
    const style = this.graph.getCellStyle(edge);
    const arrowKey = position === 'start' ? 'startArrow' : 'endArrow';
    style[arrowKey] = arrowType === 'none' ? undefined : arrowType;
    this.graph.setCellStyle(style, [edge]);
  }

  /**
   * Set edge color
   */
  setEdgeColor(edge: any, color: string): void {
    const style = this.graph.getCellStyle(edge);
    style.strokeColor = color;
    this.graph.setCellStyle(style, [edge]);
  }

  /**
   * Set edge stroke width
   */
  setEdgeStrokeWidth(edge: any, width: number): void {
    const style = this.graph.getCellStyle(edge);
    style.strokeWidth = width;
    this.graph.setCellStyle(style, [edge]);
  }

  /**
   * Apply complete edge config
   */
  applyEdgeConfig(edge: any, config: Partial<EdgeConfig>): void {
    const merged = { ...this.defaultConfig, ...config };
    const style = this.graph.getCellStyle(edge);

    style.edgeStyle = this.getEdgeStyleValue(merged.routing);
    style.strokeColor = merged.color;
    style.strokeWidth = merged.strokeWidth;
    style.endArrow = merged.endArrow === 'none' ? undefined : merged.endArrow;
    style.startArrow = merged.startArrow === 'none' ? undefined : merged.startArrow;

    // Set line style
    if (merged.style === 'solid') {
      style.dashed = '0';
    } else if (merged.style === 'dashed') {
      style.dashed = '1';
      style.dashPattern = '5 5';
    } else if (merged.style === 'dotted') {
      style.dashed = '1';
      style.dashPattern = '2 3';
    }

    this.graph.setCellStyle(style, [edge]);
  }

  /**
   * Get edge configuration
   */
  getEdgeConfig(edge: any): EdgeConfig {
    const style = this.graph.getCellStyle(edge);
    return {
      routing: this.getRoutingStyle(style.edgeStyle),
      style: this.getLineStyle(style),
      startArrow: (style.startArrow as ArrowType) || 'none',
      endArrow: (style.endArrow as ArrowType) || 'block',
      strokeWidth: parseInt(style.strokeWidth) || 2,
      color: style.strokeColor || '#000000',
    };
  }

  /**
   * Get available routing styles
   */
  getRoutingStyles(): RoutingStyle[] {
    return ['straight', 'curved', 'orthogonal'];
  }

  /**
   * Get available line styles
   */
  getLineStyles(): EdgeStyle[] {
    return ['solid', 'dashed', 'dotted'];
  }

  /**
   * Get available arrow types
   */
  getArrowTypes(): ArrowType[] {
    return ['none', 'block', 'open', 'diamond', 'circle'];
  }

  private getEdgeStyleValue(routing: RoutingStyle): string {
    switch (routing) {
      case 'straight':
        return 'straight';
      case 'curved':
        return 'curved';
      case 'orthogonal':
        return 'orthogonalEdgeStyle';
      default:
        return 'straight';
    }
  }

  private getRoutingStyle(edgeStyle: string): RoutingStyle {
    if (edgeStyle === 'orthogonalEdgeStyle') return 'orthogonal';
    if (edgeStyle === 'curved') return 'curved';
    return 'straight';
  }

  private getLineStyle(style: any): EdgeStyle {
    if (style.dashed === '1' || style.dashed === 1) {
      if (style.dashPattern && style.dashPattern.includes('2')) return 'dotted';
      return 'dashed';
    }
    return 'solid';
  }
}
