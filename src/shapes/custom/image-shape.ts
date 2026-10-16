import { RectangleShape } from '@maxgraph/core';

/**
 * Custom shape for rendering uploaded images
 */
export class ImageShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const imageUrl = (this as any).style?.image;

    if (!imageUrl) {
      // Fallback: draw placeholder
      c.setFillColor('#f5f5f5');
      c.rect(x, y, w, h);
      c.fillAndStroke();

      c.setFillColor('#999');
      c.setFontSize(12);
      c.drawText('Image', x, y + h / 2, w, 20, 'center', false, false);
      return;
    }

    // Draw the image
    const img = new Image();
    img.onload = () => {
      c.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    img.onerror = () => {
      // Fallback on error
      c.setFillColor('#ffcccc');
      c.rect(x, y, w, h);
      c.fillAndStroke();
      c.setFillColor('#cc0000');
      c.setFontSize(10);
      c.drawText('Error', x, y + h / 2, w, 20, 'center', false, false);
    };
    img.src = imageUrl;

    // Draw border
    c.setStrokeColor('#cccccc');
    c.setStrokeWidth(1);
    c.setFillColor('none');
    c.rect(x, y, w, h);
    c.stroke();
  }
}
