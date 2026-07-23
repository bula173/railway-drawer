import { Shape } from '@maxgraph/core';

/**
 * PlantUML Boundary shape - represents system boundary
 */
export class PlantUmlBoundaryShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.15;
    const lineX = w * 0.5;

    // Draw circle head at top
    c.begin();
    c.ellipse(lineX - headHeight * 0.5, 0, headHeight, headHeight);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical line (lifeline)
    c.begin();
    c.moveTo(lineX, headHeight);
    c.lineTo(lineX, h);
    c.stroke();

    // Draw horizontal line (boundary box indicator)
    c.begin();
    c.moveTo(w * 0.15, headHeight * 2);
    c.lineTo(w * 0.85, headHeight * 2);
    c.stroke();
  }
}

/**
 * PlantUML Control shape - represents controller/control logic
 */
export class PlantUmlControlShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.15;
    const lineX = w * 0.5;
    const arrowSize = headHeight * 0.5;

    // Draw circle head at top
    c.begin();
    c.ellipse(lineX - headHeight * 0.5, 0, headHeight, headHeight);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical line (lifeline)
    c.begin();
    c.moveTo(lineX, headHeight);
    c.lineTo(lineX, h);
    c.stroke();

    // Draw arrow/pointer indicator below head
    c.begin();
    c.moveTo(lineX + arrowSize, headHeight + arrowSize * 1.5);
    c.lineTo(lineX + arrowSize * 1.5, headHeight + arrowSize * 1.5);
    c.lineTo(lineX, headHeight + arrowSize * 2.5);
    c.lineTo(lineX - arrowSize * 1.5, headHeight + arrowSize * 1.5);
    c.lineTo(lineX - arrowSize, headHeight + arrowSize * 1.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * PlantUML Entity shape - represents entity/data
 */
export class PlantUmlEntityShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.15;
    const lineX = w * 0.5;

    // Draw rectangle head at top
    c.begin();
    c.moveTo(w * 0.1, 0);
    c.lineTo(w * 0.9, 0);
    c.lineTo(w * 0.9, headHeight);
    c.lineTo(w * 0.1, headHeight);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    // Draw vertical line (lifeline)
    c.begin();
    c.moveTo(lineX, headHeight);
    c.lineTo(lineX, h);
    c.stroke();
  }
}

/**
 * PlantUML Database shape - represents database/storage
 */
export class PlantUmlDatabaseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cylinderTop = h * 0.15;
    const cylinderWidth = w * 0.8;
    const cylinderX = (w - cylinderWidth) * 0.5;

    // Draw top ellipse
    c.begin();
    c.ellipse(cylinderX, 0, cylinderWidth, cylinderTop);
    c.fillAndStroke();

    c.setShadow(false);

    // Draw side walls
    c.begin();
    c.moveTo(cylinderX, cylinderTop * 0.5);
    c.lineTo(cylinderX, h - cylinderTop * 0.5);
    c.stroke();

    c.begin();
    c.moveTo(cylinderX + cylinderWidth, cylinderTop * 0.5);
    c.lineTo(cylinderX + cylinderWidth, h - cylinderTop * 0.5);
    c.stroke();

    // Draw bottom ellipse
    c.begin();
    c.ellipse(cylinderX, h - cylinderTop, cylinderWidth, cylinderTop);
    c.fillAndStroke();
  }
}

/**
 * PlantUML Collections shape - represents collection of entities
 */
export class PlantUmlCollectionsShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const boxWidth = w * 0.25;
    const boxHeight = h * 0.4;
    const spacing = w * 0.08;

    // Draw 4 stacked boxes to represent collection
    for (let i = 0; i < 3; i++) {
      const offsetY = i * spacing;
      c.begin();
      c.moveTo((w - boxWidth) * 0.5 + i * spacing, offsetY);
      c.lineTo((w - boxWidth) * 0.5 + boxWidth + i * spacing, offsetY);
      c.lineTo((w - boxWidth) * 0.5 + boxWidth + i * spacing, offsetY + boxHeight);
      c.lineTo((w - boxWidth) * 0.5 + i * spacing, offsetY + boxHeight);
      c.close();
      c.fillAndStroke();
    }

    // Draw lifeline
    c.setShadow(false);
    c.begin();
    c.moveTo(w * 0.5, h - spacing);
    c.lineTo(w * 0.5, h);
    c.stroke();
  }
}

/**
 * PlantUML Queue shape - represents message queue
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

    // Draw queue arrows on the side to indicate flow
    c.setShadow(false);
    const arrowX = w * 0.95;
    const arrowMidY = h * 0.5;

    c.begin();
    c.moveTo(arrowX - 6, arrowMidY - 3);
    c.lineTo(arrowX, arrowMidY);
    c.lineTo(arrowX - 6, arrowMidY + 3);
    c.stroke();
  }
}

/**
 * PlantUML Participant shape - standard rectangle with lifeline
 */
export class PlantUmlParticipantShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.15;

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
