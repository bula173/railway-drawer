import { RectangleShape } from '@maxgraph/core';

/**
 * Rail track shape - two parallel lines
 */
export class RailShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const trackY1 = y + h * 0.35;
    const trackY2 = y + h * 0.65;

    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    // Top rail
    c.begin();
    c.moveTo(x, trackY1);
    c.lineTo(x + w, trackY1);
    c.stroke();

    // Bottom rail
    c.begin();
    c.moveTo(x, trackY2);
    c.lineTo(x + w, trackY2);
    c.stroke();

    // Tie marks
    c.setStrokeWidth(1);
    for (let i = 0; i < 6; i++) {
      const tieX = x + (w / 6) * (i + 0.5);
      c.begin();
      c.moveTo(tieX, trackY1);
      c.lineTo(tieX, trackY2);
      c.stroke();
    }
  }
}

/**
 * Railway signal shape
 */
export class SignalShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const poleX = x + w * 0.5;

    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    // Pole
    c.begin();
    c.moveTo(poleX, y + h * 0.3);
    c.lineTo(poleX, y + h);
    c.stroke();

    // Signal head (circle)
    c.setFillColor('#ff6b6b');
    c.ellipse(x + w * 0.35, y + h * 0.2, w * 0.3, h * 0.25);
    c.fillAndStroke();
  }
}

/**
 * Railway switch/points shape
 */
export class SwitchShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    // Main track (straight through)
    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w * 0.6, y + h * 0.5);
    c.stroke();

    // Diverging track
    c.begin();
    c.moveTo(x + w * 0.6, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.2);
    c.stroke();

    // Switch point indicator
    c.setFillColor('#0066cc');
    c.ellipse(x + w * 0.55, y + h * 0.45, w * 0.08, h * 0.08);
    c.fillAndStroke();
  }
}

/**
 * Railway junction shape
 */
export class JunctionShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    // Horizontal track
    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();

    // Vertical track
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w * 0.5, y + h);
    c.stroke();

    // Center junction circle
    c.setFillColor('#0066cc');
    c.ellipse(x + w * 0.45, y + h * 0.45, w * 0.1, h * 0.1);
    c.fillAndStroke();
  }
}

/**
 * Railway platform shape
 */
export class PlatformShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#e8f4f9');
    c.setStrokeColor('#0066cc');
    c.setStrokeWidth(2);

    // Platform base
    c.rect(x, y + h * 0.3, w, h * 0.6);
    c.fillAndStroke();

    // Track
    c.setStrokeColor('#333333');
    c.begin();
    c.moveTo(x, y + h * 0.15);
    c.lineTo(x + w, y + h * 0.15);
    c.stroke();
  }
}

/**
 * Railway station shape
 */
export class StationShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#fff9e6');
    c.setStrokeColor('#ff9800');
    c.setStrokeWidth(2);

    // Building
    c.rect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.65);
    c.fillAndStroke();

    // Roof
    c.setFillColor('#ff9800');
    c.begin();
    c.moveTo(x + w * 0.1, y + h * 0.15);
    c.lineTo(x + w * 0.5, y);
    c.lineTo(x + w * 0.9, y + h * 0.15);
    c.close();
    c.fillAndStroke();

    // Door
    c.setFillColor('#8b7355');
    c.rect(x + w * 0.4, y + h * 0.55, w * 0.2, h * 0.25);
    c.fillAndStroke();
  }
}

/**
 * Railway crossing shape (grade crossing)
 */
export class CrossingShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#d32f2f');
    c.setStrokeWidth(3);
    c.setFillColor('none');

    // X pattern
    c.begin();
    c.moveTo(x + w * 0.2, y + h * 0.2);
    c.lineTo(x + w * 0.8, y + h * 0.8);
    c.stroke();

    c.begin();
    c.moveTo(x + w * 0.8, y + h * 0.2);
    c.lineTo(x + w * 0.2, y + h * 0.8);
    c.stroke();

    // Border
    c.setStrokeWidth(2);
    c.rect(x, y, w, h);
    c.stroke();
  }
}

/**
 * Railway tunnel shape
 */
export class TunnelShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('#c0c0c0');

    // Tunnel opening (semi-circle at start)
    c.begin();
    c.moveTo(x, y + h * 0.2);
    c.quadTo(x + w * 0.1, y, x + w * 0.1, y + h * 0.8);
    c.lineTo(x, y + h * 0.8);
    c.close();
    c.fillAndStroke();

    // Tunnel body
    c.rect(x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.6);
    c.fillAndStroke();

    // Track inside tunnel
    c.setStrokeColor('#666666');
    c.begin();
    c.moveTo(x + w * 0.1, y + h * 0.5);
    c.lineTo(x + w * 0.9, y + h * 0.5);
    c.stroke();
  }
}

/**
 * Railway buffer/stop shape
 */
export class BufferShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Track
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w * 0.7, y + h * 0.5);
    c.stroke();

    // Buffer stops
    c.setFillColor('#333333');
    c.rect(x + w * 0.7, y + h * 0.2, w * 0.1, h * 0.15);
    c.fillAndStroke();
    c.rect(x + w * 0.7, y + h * 0.65, w * 0.1, h * 0.15);
    c.fillAndStroke();

    // End post
    c.setStrokeWidth(3);
    c.begin();
    c.moveTo(x + w * 0.85, y + h * 0.2);
    c.lineTo(x + w * 0.85, y + h * 0.8);
    c.stroke();
  }
}

/**
 * Railway cabin/signalbox shape
 */
export class CabinShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#e3f2fd');
    c.setStrokeColor('#1976d2');
    c.setStrokeWidth(2);

    // Main building
    c.rect(x + w * 0.1, y + w * 0.1, w * 0.8, h * 0.75);
    c.fillAndStroke();

    // Roof
    c.setFillColor('#1976d2');
    c.begin();
    c.moveTo(x + w * 0.1, y + h * 0.85);
    c.lineTo(x + w * 0.5, y + h * 0.65);
    c.lineTo(x + w * 0.9, y + h * 0.85);
    c.close();
    c.fillAndStroke();

    // Windows
    c.setFillColor('#87ceeb');
    c.rect(x + w * 0.25, y + h * 0.2, w * 0.15, h * 0.2);
    c.fillAndStroke();
    c.rect(x + w * 0.6, y + h * 0.2, w * 0.15, h * 0.2);
    c.fillAndStroke();
  }
}

/**
 * Track area left marker (LTA) - left-pointing triangle
 */
export class LTAShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#000000');
    c.setStrokeColor('#000000');
    c.setStrokeWidth(1);

    c.begin();
    c.moveTo(x + w, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Track output left marker (LTO) - right-pointing triangle
 */
export class LTOShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('none');
    c.setStrokeColor('#000000');
    c.setStrokeWidth(2);

    c.begin();
    c.moveTo(x, y);
    c.lineTo(x, y + h);
    c.lineTo(x + w, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Detection point/sensor - circle marker
 */
export class DetectionPointShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const r = Math.min(w, h) * 0.4;

    c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
    c.stroke();
  }
}

/**
 * Track section horizontal
 */
export class TrackSectionShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(3);

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();
  }
}

/**
 * Vertical connector/junction line
 */
export class VerticalConnectorShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w * 0.5, y + h);
    c.stroke();
  }
}

/**
 * End-of-line marker (circle outline)
 */
export class EOLMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('#ffffff');

    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const r = Math.min(w, h) * 0.4;

    c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
    c.fillAndStroke();
  }
}

/**
 * Track level indicator - horizontal rail segment
 */
export class RailLevelShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    // Top rail
    c.begin();
    c.moveTo(x, y + h * 0.3);
    c.lineTo(x + w, y + h * 0.3);
    c.stroke();

    // Bottom rail
    c.begin();
    c.moveTo(x, y + h * 0.7);
    c.lineTo(x + w, y + h * 0.7);
    c.stroke();
  }
}

/**
 * Sloped track segment
 */
export class SlopedTrackShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    // Top slope
    c.begin();
    c.moveTo(x, y + h * 0.3);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();

    // Bottom slope
    c.begin();
    c.moveTo(x, y + h * 0.7);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();
  }
}

/**
 * Train/Locomotive
 */
export class TrainShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#8b4513');
    c.setStrokeColor('#000000');
    c.setStrokeWidth(2);

    // Main body
    c.begin();
    c.moveTo(x + w * 0.15, y + h * 0.2);
    c.lineTo(x + w * 0.85, y + h * 0.2);
    c.quadTo(x + w * 0.95, y + h * 0.3, x + w * 0.95, y + h * 0.5);
    c.lineTo(x + w * 0.95, y + h * 0.8);
    c.quadTo(x + w * 0.9, y + h * 0.9, x + w * 0.8, y + h * 0.9);
    c.lineTo(x + w * 0.2, y + h * 0.9);
    c.quadTo(x + w * 0.1, y + h * 0.9, x + w * 0.05, y + h * 0.8);
    c.lineTo(x + w * 0.05, y + h * 0.5);
    c.quadTo(x + w * 0.05, y + h * 0.3, x + w * 0.15, y + h * 0.2);
    c.close();
    c.fillAndStroke();

    // Cabin window
    c.setFillColor('#87ceeb');
    c.rect(x + w * 0.1, y + h * 0.25, w * 0.2, h * 0.2);
    c.fillAndStroke();

    // Wheels
    c.setFillColor('#333333');
    c.ellipse(x + w * 0.25 - w * 0.08, y + h * 0.85 - w * 0.08, w * 0.16, w * 0.16);
    c.fillAndStroke();
    c.ellipse(x + w * 0.6 - w * 0.08, y + h * 0.85 - w * 0.08, w * 0.16, w * 0.16);
    c.fillAndStroke();
    c.ellipse(x + w * 0.75 - w * 0.08, y + h * 0.85 - w * 0.08, w * 0.16, w * 0.16);
    c.fillAndStroke();
  }
}

/**
 * Signal head - main signal
 */
export class SignalHeadShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    // Pole
    c.begin();
    c.moveTo(x + w * 0.5, y + h * 0.4);
    c.lineTo(x + w * 0.5, y + h);
    c.stroke();

    // Signal head box
    c.setFillColor('#f0f0f0');
    c.rect(x + w * 0.2, y, w * 0.6, h * 0.4);
    c.fillAndStroke();

    // Aspect lights
    c.setFillColor('#ff6b6b');
    c.ellipse(x + w * 0.35 - w * 0.1, y + h * 0.1 - w * 0.1, w * 0.2, w * 0.2);
    c.fillAndStroke();

    c.setFillColor('#ffff00');
    c.ellipse(x + w * 0.65 - w * 0.1, y + h * 0.1 - w * 0.1, w * 0.2, w * 0.2);
    c.fillAndStroke();

    c.setFillColor('#00cc00');
    c.ellipse(x + w * 0.5 - w * 0.1, y + h * 0.35 - w * 0.1, w * 0.2, w * 0.2);
    c.fillAndStroke();
  }
}

/**
 * Radio Block Center (RBC)
 */
export class RBCShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#4169e1');
    c.setStrokeColor('#000080');
    c.setStrokeWidth(2);

    // Triangle (representing RBC)
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h);
    c.close();
    c.fillAndStroke();

    // Center marker
    c.setFillColor('#ffffff');
    c.ellipse(x + w * 0.45, y + h * 0.5 - w * 0.08, w * 0.1, w * 0.1);
    c.fillAndStroke();
  }
}

/**
 * Communication/GSM-R line (dashed)
 */
export class CommunicationLineShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#9370db');
    c.setStrokeWidth(2);
    c.setDashed(true, 5);

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();

    c.setDashed(false);
  }
}

/**
 * Electronic Block (EB) section
 */
export class EBSectionShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#e8f4f9');
    c.setStrokeColor('#0066cc');
    c.setStrokeWidth(2);

    c.rect(x, y + h * 0.25, w, h * 0.5);
    c.fillAndStroke();

    // Label indicator
    c.setFillColor('none');
    c.setStrokeColor('#0066cc');
    c.begin();
    c.moveTo(x + w * 0.1, y + h * 0.2);
    c.lineTo(x + w * 0.1, y + h * 0.25);
    c.stroke();

    c.begin();
    c.moveTo(x + w * 0.9, y + h * 0.2);
    c.lineTo(x + w * 0.9, y + h * 0.25);
    c.stroke();
  }
}

/**
 * Wayside equipment (ground-based)
 */
export class WaysideEquipmentShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#c0c0c0');
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    // Base
    c.rect(x + w * 0.2, y + h * 0.5, w * 0.6, h * 0.5);
    c.fillAndStroke();

    // Antenna/pole
    c.setFillColor('#999999');
    c.rect(x + w * 0.45, y, w * 0.1, h * 0.5);
    c.fillAndStroke();

    // Top indicator
    c.setFillColor('#ff6b6b');
    c.ellipse(x + w * 0.45, y - h * 0.05, w * 0.1, w * 0.1);
    c.fillAndStroke();
  }
}

/**
 * Track circuit
 */
export class TrackCircuitShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    // Two rails
    c.begin();
    c.moveTo(x, y + h * 0.35);
    c.lineTo(x + w, y + h * 0.35);
    c.stroke();

    c.begin();
    c.moveTo(x, y + h * 0.65);
    c.lineTo(x + w, y + h * 0.65);
    c.stroke();

    // Cross ties
    c.setStrokeWidth(1);
    for (let i = 0; i <= 4; i++) {
      const tieX = x + (w / 4) * i;
      c.begin();
      c.moveTo(tieX, y + h * 0.35);
      c.lineTo(tieX, y + h * 0.65);
      c.stroke();
    }
  }
}

/**
 * ERTMS Level Marker (Level 1, 2, or 3)
 */
export class ERTMSLevelMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#ff9800');
    c.setStrokeColor('#e65100');
    c.setStrokeWidth(2);

    // Hexagon shape
    const cornerX = w * 0.3;
    const cornerY = h * 0.25;
    c.begin();
    c.moveTo(x + cornerX, y);
    c.lineTo(x + w - cornerX, y);
    c.lineTo(x + w, y + cornerY);
    c.lineTo(x + w - cornerX, y + h);
    c.lineTo(x + cornerX, y + h);
    c.lineTo(x, y + cornerY);
    c.close();
    c.fillAndStroke();

    // Text indicator (L1, L2, L3)
    c.setFillColor('#ffffff');
    c.setFontColor('#ffffff');
    c.setFontSize(14);
  }
}

/**
 * Speed Restriction Marker
 */
export class SpeedRestrictionMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#ff6b6b');
    c.setStrokeColor('#cc0000');
    c.setStrokeWidth(2);

    // Diamond shape
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.5, y + h);
    c.lineTo(x, y + h * 0.5);
    c.close();
    c.fillAndStroke();

    // Speed value inside
    c.setFillColor('#ffffff');
  }
}

/**
 * ERTMS Balise (Transmission device on track)
 */
export class ERTMSBaliseShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#1976d2');
    c.setStrokeColor('#0d47a1');
    c.setStrokeWidth(2);

    // Rectangular coil
    c.rect(x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.6);
    c.fillAndStroke();

    // Signal lines (representing transmission)
    c.setStrokeColor('#0d47a1');
    c.setStrokeWidth(1);
    for (let i = 0; i < 3; i++) {
      c.begin();
      c.moveTo(x + w * (0.2 + i * 0.2), y + h * 0.15);
      c.lineTo(x + w * (0.2 + i * 0.2), y + h * 0.05);
      c.stroke();
    }
  }
}

/**
 * ERTMS Level Crossing
 */
export class ERTMSLevelCrossingShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Rail 1
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.begin();
    c.moveTo(x, y + h * 0.35);
    c.lineTo(x + w, y + h * 0.35);
    c.stroke();

    c.begin();
    c.moveTo(x, y + h * 0.65);
    c.lineTo(x + w, y + h * 0.65);
    c.stroke();

    // Road crossing
    c.begin();
    c.moveTo(x + w * 0.35, y);
    c.lineTo(x + w * 0.35, y + h);
    c.stroke();

    c.begin();
    c.moveTo(x + w * 0.65, y);
    c.lineTo(x + w * 0.65, y + h);
    c.stroke();

    // Crossing warning lights
    c.setFillColor('#ff0000');
    c.ellipse(x + w * 0.25 - w * 0.06, y + h * 0.15 - w * 0.06, w * 0.12, w * 0.12);
    c.fillAndStroke();

    c.ellipse(x + w * 0.75 - w * 0.06, y + h * 0.15 - w * 0.06, w * 0.12, w * 0.12);
    c.fillAndStroke();
  }
}

/**
 * ERTMS Handover Point (transition between systems)
 */
export class ERTMSHandoverPointShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#9c27b0');
    c.setStrokeColor('#6a1b9a');
    c.setStrokeWidth(2);

    // Circle
    c.ellipse(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8);
    c.fillAndStroke();

    // Inner circle (overlap marker)
    c.setFillColor('#ffffff');
    c.ellipse(x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5);
    c.fillAndStroke();

    // Arrow indicating direction
    c.setStrokeColor('#6a1b9a');
    c.setStrokeWidth(2);
    c.begin();
    c.moveTo(x + w * 0.5, y + h * 0.3);
    c.lineTo(x + w * 0.7, y + h * 0.5);
    c.lineTo(x + w * 0.5, y + h * 0.7);
    c.stroke();
  }
}

/**
 * National System Transition Point
 */
export class NationalTransitionPointShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#4caf50');
    c.setStrokeColor('#2e7d32');
    c.setStrokeWidth(2);

    // Pentagon shape
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w * 0.95, y + h * 0.35);
    c.lineTo(x + w * 0.75, y + h);
    c.lineTo(x + w * 0.25, y + h);
    c.lineTo(x + w * 0.05, y + h * 0.35);
    c.close();
    c.fillAndStroke();

    // Border indicator
    c.setStrokeColor('#2e7d32');
    c.setStrokeWidth(1);
    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();
  }
}

/**
 * ERTMS Transponder Tag
 */
export class ERTMSTransponderShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#00bcd4');
    c.setStrokeColor('#00838f');
    c.setStrokeWidth(2);

    // Main body
    c.rect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6);
    c.fillAndStroke();

    // Antenna
    c.setStrokeColor('#00838f');
    c.setStrokeWidth(2);
    c.begin();
    c.moveTo(x + w * 0.3, y + h * 0.2);
    c.lineTo(x + w * 0.3, y);
    c.stroke();

    c.begin();
    c.moveTo(x + w * 0.7, y + h * 0.2);
    c.lineTo(x + w * 0.7, y);
    c.stroke();

    // Signal indicator
    c.setFillColor('#ffffff');
    c.ellipse(x + w * 0.35 - w * 0.06, y + h * 0.35 - w * 0.06, w * 0.12, w * 0.12);
    c.fillAndStroke();

    c.ellipse(x + w * 0.65 - w * 0.06, y + h * 0.35 - w * 0.06, w * 0.12, w * 0.12);
    c.fillAndStroke();
  }
}

/**
 * ERTMS Section Marker
 */
export class ERTMSSectionMarkerShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor('#ffc107');
    c.setStrokeColor('#ff8f00');
    c.setStrokeWidth(2);

    // Rounded rectangle
    const radius = w * 0.15;
    c.begin();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.quadTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius);
    c.quadTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h);
    c.quadTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius);
    c.quadTo(x, y, x + radius, y);
    c.close();
    c.fillAndStroke();

    // Section indicator line
    c.setStrokeColor('#ff8f00');
    c.setStrokeWidth(1);
    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.stroke();
  }
}
