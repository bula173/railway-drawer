/**
 * @file index.ts
 * @brief ERTMS shapes - railway signaling elements
 */

import { RectangleShape } from '@maxgraph/core';
import { CellRenderer } from '@maxgraph/core';
import { shapeRegistry } from '../registry';

/**
 * Signal Light Shape - 3 lights in a column
 */
class SignalLightShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('none');
    c.setStrokeColor('#404040');
    c.setStrokeWidth(1);
    c.rect(x, y, w, h);
    c.stroke();

    // Draw 3 indicator lights
    const lightSize = Math.min(w - 6, 8);
    const startY = y + (h - lightSize * 3 - 6) / 2;
    const startX = x + (w - lightSize) / 2;

    // Light 1
    c.setFillColor('#ffffff');
    c.ellipse(startX, startY, lightSize, lightSize);
    c.fillAndStroke();

    // Light 2
    c.setFillColor('#ffffff');
    c.ellipse(startX, startY + lightSize + 2, lightSize, lightSize);
    c.fillAndStroke();

    // Light 3
    c.setFillColor('#e00000');
    c.ellipse(startX, startY + (lightSize + 2) * 2, lightSize, lightSize);
    c.fillAndStroke();
  }
}

/**
 * Track Shape - railway line
 */
class TrackLineShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw rails
    c.setFillColor('#333333');
    c.rect(x + 1, y + 2, 2, h - 4);
    c.fill();
    c.rect(x + w - 3, y + 2, 2, h - 4);
    c.fill();

    // Draw ballast
    c.setFillColor('#a5a5a5');
    c.rect(x, y, w, h);
    c.stroke();
  }
}

/**
 * Train Shape - ETCS L2
 */
class TrainIconShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#f5f5f5');
    c.setStrokeColor('#404040');
    c.rect(x, y, w, h);
    c.fillAndStroke();

    c.setFontSize(10);
    c.setFillColor('#000000');
    c.drawString('ETCS L2', x + 2, y + h / 2 - 5, w - 4, 12, 'center');
  }
}

/**
 * Balise Shape - Track Circuit marker
 */
class BaliseMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Draw antenna
    c.setFillColor('#000000');
    c.rect(x + w / 2 - 1, y, 2, h / 2);
    c.fill();

    // Draw marker
    c.setFillColor('#ffff00');
    c.setStrokeColor('#000000');
    c.ellipse(x + w / 2 - 3, y + h / 2, 6, h / 2 - 1);
    c.fillAndStroke();
  }
}

/**
 * Register ERTMS shapes
 */
export function registerErtmsShapes(): void {
  CellRenderer.registerShape('ertms-signal', SignalLightShape as any);
  CellRenderer.registerShape('ertms-track', TrackLineShape as any);
  CellRenderer.registerShape('ertms-train', TrainIconShape as any);
  CellRenderer.registerShape('ertms-balise', BaliseMarkerShape as any);

  // Register in shape registry for toolbar
  shapeRegistry.register({
    id: 'ertms-signal',
    type: 'vertex',
    label: 'Signal (3-Light)',
    icon: `<svg viewBox="0 0 32 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="2" width="16" height="56" fill="none" stroke="#404040" stroke-width="1"/>
      <circle cx="16" cy="12" r="5" fill="#ffffff" stroke="#404040"/>
      <circle cx="16" cy="27" r="5" fill="#ffffff" stroke="#404040"/>
      <circle cx="16" cy="42" r="5" fill="#e00000" stroke="#404040"/>
    </svg>`,
    group: 'ERTMS',
    width: 43,
    height: 60,
    style: { shape: 'ertms-signal', fillColor: 'none', strokeColor: '#404040' },
  });

  shapeRegistry.register({
    id: 'ertms-train',
    type: 'vertex',
    label: 'Train (ETCS L2)',
    icon: `<svg viewBox="0 0 50 20" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="46" height="16" fill="#f5f5f5" stroke="#404040" stroke-width="1"/>
      <text x="25" y="14" font-size="8" text-anchor="middle" fill="#000000">ETCS L2</text>
    </svg>`,
    group: 'ERTMS',
    width: 50,
    height: 20,
    style: { shape: 'ertms-train', fillColor: '#f5f5f5', strokeColor: '#404040' },
  });

  shapeRegistry.register({
    id: 'ertms-track',
    type: 'vertex',
    label: 'Track',
    icon: `<svg viewBox="0 0 100 10" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="3" x2="98" y2="3" stroke="#333333" stroke-width="2"/>
      <line x1="2" y1="7" x2="98" y2="7" stroke="#333333" stroke-width="2"/>
      <rect x="0" y="0" width="100" height="10" fill="#a5a5a5" opacity="0.3"/>
    </svg>`,
    group: 'ERTMS',
    width: 150,
    height: 10,
    style: { shape: 'ertms-track', fillColor: 'none', strokeColor: 'none' },
  });

  shapeRegistry.register({
    id: 'ertms-balise',
    type: 'vertex',
    label: 'Balise (TC)',
    icon: `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="0" x2="6" y2="5" stroke="#000000" stroke-width="1"/>
      <circle cx="6" cy="8" r="3" fill="#ffff00" stroke="#000000" stroke-width="0.5"/>
    </svg>`,
    group: 'ERTMS',
    width: 12,
    height: 12,
    style: { shape: 'ertms-balise', fillColor: 'none', strokeColor: '#000000' },
  });

  console.log('[ERTMS] Registered 4 shapes in toolbar');
}
