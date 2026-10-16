import { Shape } from '@maxgraph/core';

/**
 * PlantUML Boundary shape - circle head with lifeline
 */
export class PlantUmlBoundaryShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headSize = w * 0.6;
    const headX = (w - headSize) / 2;
    const headY = 0;
    const lineX = w * 0.5;

    // Draw circle head
    c.begin();
    c.ellipse(headX, headY, headSize, headSize);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical lifeline
    c.begin();
    c.moveTo(lineX, headSize);
    c.lineTo(lineX, h);
    c.stroke();
  }
}

/**
 * PlantUML Control shape - circle with control indicator
 */
export class PlantUmlControlShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headSize = w * 0.6;
    const headX = (w - headSize) / 2;
    const headY = 0;
    const lineX = w * 0.5;
    const arrowSize = headSize * 0.25;

    // Draw circle head
    c.begin();
    c.ellipse(headX, headY, headSize, headSize);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical lifeline
    c.begin();
    c.moveTo(lineX, headSize);
    c.lineTo(lineX, h);
    c.stroke();

    // Draw small arrow below head to indicate control
    c.begin();
    c.moveTo(lineX + arrowSize, headSize + arrowSize * 1.5);
    c.lineTo(lineX, headSize + arrowSize * 2);
    c.lineTo(lineX - arrowSize, headSize + arrowSize * 1.5);
    c.stroke();
  }
}

/**
 * PlantUML Entity shape - rectangle head with lifeline
 */
export class PlantUmlEntityShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.2;
    const lineX = w * 0.5;

    // Draw rectangle head
    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, headHeight);
    c.lineTo(0, headHeight);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical lifeline
    c.begin();
    c.moveTo(lineX, headHeight);
    c.lineTo(lineX, h);
    c.stroke();
  }
}

/**
 * PlantUML Database shape - cylinder
 */
export class PlantUmlDatabaseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const ellipseHeight = h * 0.15;
    const cylinderX = (w - w * 0.8) / 2;
    const cylinderWidth = w * 0.8;

    // Draw top ellipse
    c.begin();
    c.ellipse(cylinderX, 0, cylinderWidth, ellipseHeight);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw left and right lines
    c.begin();
    c.moveTo(cylinderX, ellipseHeight * 0.5);
    c.lineTo(cylinderX, h - ellipseHeight * 0.5);
    c.stroke();

    c.begin();
    c.moveTo(cylinderX + cylinderWidth, ellipseHeight * 0.5);
    c.lineTo(cylinderX + cylinderWidth, h - ellipseHeight * 0.5);
    c.stroke();

    // Draw bottom ellipse
    c.begin();
    c.ellipse(cylinderX, h - ellipseHeight, cylinderWidth, ellipseHeight);
    c.fillAndStroke();
  }
}

/**
 * PlantUML Collections shape - stacked boxes
 */
export class PlantUmlCollectionsShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const boxWidth = w * 0.5;
    const boxHeight = h * 0.25;
    const boxX = (w - boxWidth) / 2;
    const spacing = h * 0.08;

    // Draw 3 stacked boxes
    for (let i = 0; i < 3; i++) {
      const offsetY = i * spacing;
      c.begin();
      c.moveTo(boxX + i * spacing, offsetY);
      c.lineTo(boxX + boxWidth + i * spacing, offsetY);
      c.lineTo(boxX + boxWidth + i * spacing, offsetY + boxHeight);
      c.lineTo(boxX + i * spacing, offsetY + boxHeight);
      c.close();
      c.fillAndStroke();
    }
  }
}

/**
 * PlantUML Queue shape - queue representation
 */
export class PlantUmlQueueShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const queueHeight = h * 0.2;
    const queueCount = 3;
    const spacing = (h - queueHeight) / queueCount;

    // Draw stacked queue elements
    for (let i = 0; i < queueCount; i++) {
      const offsetY = i * spacing;
      c.begin();
      c.moveTo(w * 0.1, offsetY);
      c.lineTo(w * 0.9, offsetY);
      c.lineTo(w * 0.9, offsetY + queueHeight);
      c.lineTo(w * 0.1, offsetY + queueHeight);
      c.close();
      c.fillAndStroke();
    }
  }
}

/**
 * PlantUML Participant shape - standard box with lifeline
 */
export class PlantUmlParticipantShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.3;

    // Draw head rectangle
    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, headHeight);
    c.lineTo(0, headHeight);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    // Draw lifeline (dashed vertical line)
    c.begin();
    c.setDashed(true, 2);
    c.moveTo(w * 0.5, headHeight);
    c.lineTo(w * 0.5, h);
    c.stroke();
    c.setDashed(false);
  }
}
