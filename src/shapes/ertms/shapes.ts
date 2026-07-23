/**
 * @file shapes.ts
 * @brief ERTMS custom shape definitions
 * @details Defines vertex-based shapes for ERTMS symbols:
 * - Signal: Pole with 3 signal heads
 * - Single Balise: Arrow/marker pointing right
 * - Balise Group: Two balises side by side
 * - Marker: Box with downward indicator
 */

import { RectangleShape } from '@maxgraph/core';

/**
 * @class ERTMSSignalShape
 * @brief Railway signal with pole and 3 signal heads
 * @details
 * Represents a signal pole with three stacked circular signal heads.
 * Similar to ASCII: |---OOO
 */
export class ERTMSSignalShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const headRadius = w * 0.25;
    const poleWidth = w * 0.15;
    const poleX = x + w / 2 - poleWidth / 2;

    // Draw pole (vertical line)
    c.rect(poleX, y + h * 0.3, poleWidth, h * 0.65);
    c.stroke();

    // Draw 3 signal heads (circles)
    const headY1 = y + h * 0.15;
    const headY2 = y + h * 0.5;
    const headY3 = y + h * 0.85;
    const headX = x + w / 2;

    // Top head
    c.ellipse(headX - headRadius, headY1 - headRadius, headRadius * 2, headRadius * 2);
    c.stroke();

    // Middle head
    c.ellipse(headX - headRadius, headY2 - headRadius, headRadius * 2, headRadius * 2);
    c.stroke();

    // Bottom head
    c.ellipse(headX - headRadius, headY3 - headRadius, headRadius * 2, headRadius * 2);
    c.stroke();
  }
}

/**
 * @class SingleBaliseShape
 * @brief ERTMS Single Balise marker
 * @details
 * Represents a single balise (right-pointing arrow/marker).
 * Similar to ASCII: |>
 */
export class SingleBaliseShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const pointX = x + w;
    const midY = y + h / 2;

    // Draw right-pointing triangle (arrow)
    c.begin();
    c.moveTo(x, y);
    c.lineTo(x, y + h);
    c.lineTo(pointX, midY);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * @class BaliseGroupShape
 * @brief ERTMS Balise Group (two balises)
 * @details
 * Represents two balises side by side.
 * Similar to ASCII: |>|>
 */
export class BaliseGroupShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const midY = y + h / 2;
    const halfW = w / 2;
    const gap = w * 0.1;

    // First balise (left)
    const x1 = x;
    const pointX1 = x + halfW - gap / 2;

    c.begin();
    c.moveTo(x1, y);
    c.lineTo(x1, y + h);
    c.lineTo(pointX1, midY);
    c.close();
    c.fillAndStroke();

    // Second balise (right)
    const x2 = x + halfW + gap / 2;
    const pointX2 = x + w;

    c.begin();
    c.moveTo(x2, y);
    c.lineTo(x2, y + h);
    c.lineTo(pointX2, midY);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * @class ERTMSMarkerShape
 * @brief ERTMS Marker with downward indicator
 * @details
 * Represents a marker with a box and downward V indicator.
 * Similar to ASCII:
 * [ v]
 *   |
 *   _
 */
export class ERTMSMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const boxHeight = h * 0.4;
    const stemWidth = w * 0.15;

    // Draw main box
    c.rect(x, y, w, boxHeight);
    c.fillAndStroke();

    // Draw downward V (chevron indicator)
    const vStartX = x + w / 2 - w * 0.15;
    const vStartY = y + boxHeight + h * 0.05;
    const vBottomX = x + w / 2;
    const vBottomY = y + boxHeight + h * 0.2;
    const vEndX = x + w / 2 + w * 0.15;

    c.begin();
    c.moveTo(vStartX, vStartY);
    c.lineTo(vBottomX, vBottomY);
    c.lineTo(vEndX, vStartY);
    c.stroke();

    // Draw stem (vertical line down from V)
    const stemX = x + w / 2;
    c.begin();
    c.moveTo(stemX, vBottomY);
    c.lineTo(stemX, y + h - h * 0.15);
    c.stroke();

    // Draw base indicator (horizontal line)
    const baseY = y + h - h * 0.08;
    c.begin();
    c.moveTo(stemX - stemWidth, baseY);
    c.lineTo(stemX + stemWidth, baseY);
    c.stroke();
  }
}
