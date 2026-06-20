/**
 * @file connectorStyles.ts
 * @brief Connector styling and configuration utilities
 */

export type ConnectorArrowStyle = 'none' | 'standard' | 'block' | 'classic' | 'circle' | 'diamond';
export type ConnectorLineStyle = 'solid' | 'dotted' | 'dashed';
export type ConnectorLineWidth = 1 | 2 | 3 | 4;

export interface ConnectorStyle {
  lineStyle: ConnectorLineStyle;
  lineWidth: ConnectorLineWidth;
  startArrow: ConnectorArrowStyle;
  endArrow: ConnectorArrowStyle;
  color: string;
  opacity: number;
}

export interface Connector {
  id: string;
  fromElementId: string;
  toElementId: string;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  style: ConnectorStyle;
  label?: string;
}

export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = {
  lineStyle: 'solid',
  lineWidth: 2,
  startArrow: 'none',
  endArrow: 'standard',
  color: '#333333',
  opacity: 1,
};

export const ARROW_STYLES: Record<ConnectorArrowStyle, string> = {
  none: 'None',
  standard: 'Arrow',
  block: 'Block',
  classic: 'Classic',
  circle: 'Circle',
  diamond: 'Diamond',
};

export const LINE_STYLES: Record<ConnectorLineStyle, string> = {
  solid: 'Solid',
  dotted: 'Dotted',
  dashed: 'Dashed',
};

export const LINE_WIDTHS: ConnectorLineWidth[] = [1, 2, 3, 4];

export function getDashArray(style: ConnectorLineStyle, lineWidth: ConnectorLineWidth): string {
  switch (style) {
    case 'solid':
      return '';
    case 'dotted':
      return `${lineWidth},${lineWidth * 2}`;
    case 'dashed':
      return `${lineWidth * 4},${lineWidth * 2}`;
    default:
      return '';
  }
}

export function getArrowMarkerPath(arrowStyle: ConnectorArrowStyle, lineWidth: ConnectorLineWidth): string {
  const size = 8 + lineWidth * 2;

  switch (arrowStyle) {
    case 'standard':
      return `M0,0 L${size},-${size/2} L${size},${size/2} Z`;
    case 'block':
      return `M0,-${size/2} L${size/2},-${size/2} L${size/2},${size/2} L0,${size/2} Z`;
    case 'classic':
      return `M0,0 L${size},-${size/2} L${size * 0.8},0 L${size},${size/2} Z`;
    case 'circle':
      return `M${size/2},0 A${size/2},${size/2} 0 1,1 ${size/2},-1 Z`;
    case 'diamond':
      return `M0,0 L${size/2},-${size/2} L${size},-${size/2} L${size/2},0 L${size},${size/2} L${size/2},${size/2} Z`;
    default:
      return '';
  }
}
