/**
 * @file shapes.ts
 * @brief ERTMS custom shape definitions
 * @details Defines vertex-based shapes for ERTMS symbols:
 * - Signal: Pole with 3 signal heads
 * - Single Balise: Arrow/marker pointing right
 * - Balise Group: Two balises side by side
 * - Marker: Box with downward indicator
 */
import { Shape } from '@maxgraph/core';

/**
 * Composite shape: ERTMSMarkerBoard
 * Generated from shape designer composition
 */
export class ERTMSMarkerBoard extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const scale = { x: w / 200, y: h / 200 };
    c.fillStyle = '#1976d2';
    c.strokeStyle = '#0d47a1';
    c.lineWidth = 2;
    c.rect(x + 146.92168434773163 * scale.x, y + 16.22904522249176 * scale.y, 60 * scale.x, 60 * scale.y);
    c.fill();
    c.stroke();

    c.fillStyle = '#ffff00';
    c.strokeStyle = '#0d47a1';
    c.lineWidth = 2;
    c.save();
    c.translate(x + 177.05123284695318 * scale.x, y + 46.10753466816322 * scale.y);
    c.rotate(180 * Math.PI / 180);
    c.translate(-x - 177.05123284695318 * scale.x, -y - 46.10753466816322 * scale.y);
    c.begin();
    c.moveTo(x + 177.05123284695318 * scale.x, y + 16.10753466816322 * scale.y);
    c.lineTo(x + 207.05123284695318 * scale.x, y + 76.10753466816323 * scale.y);
    c.lineTo(x + 147.05123284695318 * scale.x, y + 76.10753466816323 * scale.y);
    c.close();
    c.fillAndStroke();
    c.restore();

    c.fillStyle = '#1976d2';
    c.strokeStyle = '#0d47a1';
    c.lineWidth = 2;
    c.begin();
    c.moveTo(x + 111.46783011694849 * scale.x, y + 44.143524385386876 * scale.y);
    c.lineTo(x + 148.5271009087947 * scale.x, y + 44.143524385386876 * scale.y);
    c.stroke();

    c.fillStyle = '#1976d2';
    c.strokeStyle = '#0d47a1';
    c.lineWidth = 2;
    c.save();
    c.translate(x + 111.37934030920742 * scale.x, y + 73.69517361236831 * scale.y);
    c.rotate(90 * Math.PI / 180);
    c.translate(-x - 111.37934030920742 * scale.x, -y - 73.69517361236831 * scale.y);
    c.begin();
    c.moveTo(x + 81.37934030920742 * scale.x, y + 73.69517361236831 * scale.y);
    c.lineTo(x + 141.3793403092074 * scale.x, y + 73.69517361236831 * scale.y);
    c.stroke();
    c.restore();
  }
}
