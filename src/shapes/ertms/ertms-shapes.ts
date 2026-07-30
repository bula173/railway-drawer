/**
 * @file ertms-shapes.ts
 * @brief ERTMS shapes as editable complex shapes from draw.io
 * @details
 * Each ERTMS shape is composed of multiple editable components
 * Users can modify colors, styles, and layouts through Properties Panel
 */

import { ComplexShape, ShapeComponent } from '../complex-shape';

/**
 * Signal Left (3-light signal)
 * Components: 3 indicator lights + background
 */
export class SignalLeftShape extends ComplexShape {
  constructor() {
    super();

    // Define editable components
    this.registerComponent({
      id: 'light-1',
      type: 'vertex',
      style: 'fillColor=#ffffff;strokeColor=#404040;',
      value: 'Light 1',
      editable: true,
    });

    this.registerComponent({
      id: 'light-2',
      type: 'vertex',
      style: 'fillColor=#ffffff;strokeColor=#404040;',
      value: 'Light 2',
      editable: true,
    });

    this.registerComponent({
      id: 'light-3',
      type: 'vertex',
      style: 'fillColor=#e00000;strokeColor=#404040;',
      value: 'Light 3 (Red)',
      editable: true,
    });

    this.registerComponent({
      id: 'background',
      type: 'vertex',
      style: 'fillColor=none;strokeColor=#404040;',
      value: 'Signal Frame',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw signal background
    c.setFillColor('none');
    c.setStrokeColor('#404040');
    c.setStrokeWidth(1);
    c.rect(x, y, w, h);
    c.stroke();

    // Draw 3 indicator lights
    const lightW = 9;
    const lightH = 9;
    const spacing = 9;
    const startX = x + 2;
    const startY = y + 2;

    // Light 1 (white)
    c.setFillColor('#ffffff');
    c.rect(startX, startY, lightW, lightH);
    c.fillAndStroke();

    // Light 2 (white)
    c.setFillColor('#ffffff');
    c.rect(startX + spacing, startY, lightW, lightH);
    c.fillAndStroke();

    // Light 3 (red - component 3)
    const light3Style = this.getComponent('light-3')?.style || 'fillColor=#e00000;';
    const fillColor = light3Style.match(/fillColor=([^;]+)/)?.[1] || '#e00000';
    c.setFillColor(fillColor);
    c.rect(startX + spacing * 2, startY, lightW, lightH);
    c.fillAndStroke();

    // Draw frame
    c.setFillColor('none');
    c.setStrokeColor('#404040');
    c.rect(x, y, w, h);
    c.stroke();
  }
}

/**
 * Train (ETCS L2)
 * Components: text label + connectivity indicator
 */
export class TrainShape extends ComplexShape {
  constructor() {
    super();

    this.registerComponent({
      id: 'label',
      type: 'text',
      style: 'fontSize=12;fontColor=#000000;',
      value: 'ETCS L2',
      editable: true,
    });

    this.registerComponent({
      id: 'indicator',
      type: 'vertex',
      style: 'fillColor=#f0f0f0;strokeColor=#404040;',
      value: 'Connected',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw train box
    c.setFillColor('#f5f5f5');
    c.setStrokeColor('#404040');
    c.rect(x, y, w, h);
    c.fillAndStroke();

    // Draw text label
    const labelComp = this.getComponent('label');
    const text = labelComp?.value || 'ETCS L2';
    c.setFontSize(12);
    c.setFillColor('#000000');
    c.drawString(text, x + 4, y + h / 2 + 4, w - 8, 16, 'center');
  }
}

/**
 * Track (railway line)
 * Components: left rail + right rail + ballast
 */
export class TrackShape extends ComplexShape {
  constructor() {
    super();

    this.registerComponent({
      id: 'rail-left',
      type: 'edge',
      style: 'strokeColor=#333333;strokeWidth=2;',
      value: 'Left Rail',
      editable: true,
    });

    this.registerComponent({
      id: 'rail-right',
      type: 'edge',
      style: 'strokeColor=#333333;strokeWidth=2;',
      value: 'Right Rail',
      editable: true,
    });

    this.registerComponent({
      id: 'ballast',
      type: 'vertex',
      style: 'fillColor=#a5a5a5;',
      value: 'Ballast',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw ballast (background)
    c.setFillColor('#a5a5a5');
    c.rect(x, y, w, h);
    c.fill();

    // Draw left rail
    c.setFillColor('#333333');
    c.rect(x + 2, y + 1, 2, h - 2);
    c.fill();

    // Draw right rail
    c.rect(x + w - 4, y + 1, 2, h - 2);
    c.fill();

    // Draw tie lines
    c.setStrokeColor('#663333');
    c.setStrokeWidth(1);
    for (let i = 0; i < w; i += 6) {
      c.line(x + 4 + i, y + h / 2, x + w - 4 + i, y + h / 2);
    }
  }
}

/**
 * Balise (Track Circuit marker)
 * Components: antenna + marker
 */
export class BaliseShape extends ComplexShape {
  constructor() {
    super();

    this.registerComponent({
      id: 'antenna',
      type: 'vertex',
      style: 'fillColor=#000000;',
      value: 'Antenna',
      editable: true,
    });

    this.registerComponent({
      id: 'marker',
      type: 'vertex',
      style: 'fillColor=#ffff00;strokeColor=#000000;',
      value: 'Marker',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw antenna
    c.setFillColor('#000000');
    c.rect(x + w / 2 - 1, y, 2, h / 2);
    c.fill();

    // Draw marker triangle
    c.setFillColor('#ffff00');
    c.setStrokeColor('#000000');
    c.triangle(x, y + h / 2, x + w, y + h / 2, x + w / 2, y + h);
    c.fillAndStroke();
  }
}
