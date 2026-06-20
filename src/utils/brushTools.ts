/**
 * @file brushTools.ts
 * @brief Brush tool definitions and utilities for freehand drawing
 */

export type BrushType = 'freehand' | 'pen' | 'marker' | 'pencil' | 'annotation';

export interface BrushConfig {
  type: BrushType;
  size: number;
  color: string;
  opacity: number;
  smoothing: number; // 0-1, higher = more smooth
  pressure: boolean; // Enable pressure sensitivity
  temporary: boolean; // For annotations only
}

export interface BrushStroke {
  id: string;
  type: BrushType;
  points: Array<{ x: number; y: number; pressure?: number }>;
  config: BrushConfig;
  created: number;
  temporary?: boolean;
}

export const BRUSH_PRESETS: Record<BrushType, Omit<BrushConfig, 'color'>> = {
  freehand: {
    type: 'freehand',
    size: 2,
    opacity: 1,
    smoothing: 0.5,
    pressure: true,
    temporary: false,
  },
  pen: {
    type: 'pen',
    size: 1.5,
    opacity: 1,
    smoothing: 0.8,
    pressure: false,
    temporary: false,
  },
  marker: {
    type: 'marker',
    size: 8,
    opacity: 0.5,
    smoothing: 0.3,
    pressure: true,
    temporary: false,
  },
  pencil: {
    type: 'pencil',
    size: 1,
    opacity: 0.8,
    smoothing: 0.2,
    pressure: true,
    temporary: false,
  },
  annotation: {
    type: 'annotation',
    size: 3,
    opacity: 0.7,
    smoothing: 0.4,
    pressure: false,
    temporary: true,
  },
};

export const BRUSH_DESCRIPTIONS: Record<BrushType, string> = {
  freehand: 'Smooth, artistic freehand drawing',
  pen: 'Precise, thin pen strokes',
  marker: 'Bold, transparent marker',
  pencil: 'Sketchy, textured pencil',
  annotation: 'Temporary markup (not saved)',
};

/**
 * Smooth a path using Catmull-Rom spline interpolation
 */
export function smoothPath(
  points: Array<{ x: number; y: number }>,
  smoothing: number
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;
  if (smoothing === 0) return points;

  const smoothedPoints: Array<{ x: number; y: number }> = [];
  const tension = 0.5;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    smoothedPoints.push(p1);

    const steps = Math.max(2, Math.ceil(smoothing * 5));
    for (let t = 0.1; t < 1; t += 1 / steps) {
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      smoothedPoints.push({ x, y });
    }
  }

  smoothedPoints.push(points[points.length - 1]);
  return smoothedPoints;
}

/**
 * Generate SVG path string from points
 */
export function pointsToSVGPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }

  const path = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    path.push(`L ${points[i].x} ${points[i].y}`);
  }

  return path.join(' ');
}

/**
 * Generate SVG path with variable width (for pressure sensitivity)
 */
export function generateVariableWidthPath(
  points: Array<{ x: number; y: number; pressure?: number }>,
  baseSize: number
): string {
  if (points.length < 2) return '';

  let pathData = '';

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];

    const pressure = current.pressure ?? 1;
    const width = baseSize * pressure;

    const angle = Math.atan2(next.y - current.y, next.x - current.x);
    const perpX = Math.sin(angle);
    const perpY = -Math.cos(angle);

    const offset = width / 2;

    const x1 = current.x - perpX * offset;
    const y1 = current.y - perpY * offset;
    const x2 = current.x + perpX * offset;
    const y2 = current.y + perpY * offset;

    if (i === 0) {
      pathData += `M ${x1} ${y1} `;
    }

    pathData += `L ${x1} ${y1} `;
  }

  for (let i = points.length - 1; i > 0; i--) {
    const current = points[i];
    const prev = points[i - 1];

    const pressure = current.pressure ?? 1;
    const width = baseSize * pressure;

    const angle = Math.atan2(current.y - prev.y, current.x - prev.x);
    const perpX = Math.sin(angle);
    const perpY = -Math.cos(angle);

    const offset = width / 2;

    const x1 = current.x + perpX * offset;
    const y1 = current.y + perpY * offset;

    pathData += `L ${x1} ${y1} `;
  }

  pathData += 'Z';
  return pathData;
}

/**
 * Create sketchy effect by adding random jitter
 */
export function addSketchyEffect(
  points: Array<{ x: number; y: number }>,
  intensity: number
): Array<{ x: number; y: number }> {
  return points.map(p => ({
    x: p.x + (Math.random() - 0.5) * intensity,
    y: p.y + (Math.random() - 0.5) * intensity,
  }));
}

/**
 * Detect if stroke is a tap (very short stroke)
 */
export function isStrokeTap(points: Array<{ x: number; y: number }>): boolean {
  if (points.length < 2) return true;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const distance = Math.sqrt(
    Math.pow(lastPoint.x - firstPoint.x, 2) + Math.pow(lastPoint.y - firstPoint.y, 2)
  );

  return distance < 5; // Less than 5px distance
}

/**
 * Simplify path by removing points that are too close together
 */
export function simplifyPath(
  points: Array<{ x: number; y: number }>,
  minDistance: number = 2
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  const simplified: Array<{ x: number; y: number }> = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lastPoint = simplified[simplified.length - 1];
    const currentPoint = points[i];

    const distance = Math.sqrt(
      Math.pow(currentPoint.x - lastPoint.x, 2) +
        Math.pow(currentPoint.y - lastPoint.y, 2)
    );

    if (distance >= minDistance) {
      simplified.push(currentPoint);
    }
  }

  return simplified;
}
