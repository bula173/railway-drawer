/**
 * @file alignmentUtils.ts
 * @brief Utilities for aligning and distributing elements
 *
 * Features:
 * - Align left, right, center horizontally
 * - Align top, middle, bottom vertically
 * - Distribute spacing evenly
 * - Smart guide detection
 * - Alignment visualization
 */

import type { DrawElement } from '../components/Elements';
import { logger } from './logger';

/**
 * @interface AlignmentBounds
 * @brief Bounding box for an element
 */
export interface AlignmentBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * @interface SmartGuide
 * @brief A guide line for alignment
 */
export interface SmartGuide {
  type: 'vertical' | 'horizontal';
  position: number; // x or y coordinate
  elementIds: string[];
  matchCount: number;
}

/**
 * @interface AlignmentResult
 * @brief Result of alignment operation
 */
export interface AlignmentResult {
  alignedElements: DrawElement[];
  alignmentType: string;
  boundsChanged: boolean;
  guid?: string;
}

/**
 * Get bounding box for an element
 */
export const getElementBounds = (element: DrawElement): AlignmentBounds => {
  const minX = Math.min(element.start.x, element.end.x);
  const maxX = Math.max(element.start.x, element.end.x);
  const minY = Math.min(element.start.y, element.end.y);
  const maxY = Math.max(element.start.y, element.end.y);

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
};

/**
 * Get bounds for multiple elements
 */
export const getGroupBounds = (elements: DrawElement[]): AlignmentBounds => {
  if (elements.length === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  const bounds = elements.map(el => getElementBounds(el));

  const left = Math.min(...bounds.map(b => b.left));
  const right = Math.max(...bounds.map(b => b.right));
  const top = Math.min(...bounds.map(b => b.top));
  const bottom = Math.max(...bounds.map(b => b.bottom));

  const width = right - left;
  const height = bottom - top;

  return {
    left,
    right,
    top,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

/**
 * Update element position
 */
const updateElementPosition = (
  element: DrawElement,
  deltaX: number,
  deltaY: number
): DrawElement => {
  return {
    ...element,
    start: {
      x: element.start.x + deltaX,
      y: element.start.y + deltaY,
    },
    end: {
      x: element.end.x + deltaX,
      y: element.end.y + deltaY,
    },
  };
};

/**
 * Align elements to the left
 */
export const alignLeft = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'left', boundsChanged: false };
  }

  const bounds = elements.map(el => getElementBounds(el));
  const leftmost = Math.min(...bounds.map(b => b.left));

  const aligned = elements.map((el, idx) => {
    const currentLeft = bounds[idx].left;
    const delta = leftmost - currentLeft;
    return updateElementPosition(el, delta, 0);
  });

  logger.debug('alignmentUtils', 'Aligned left', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'left', boundsChanged: true };
};

/**
 * Align elements to the right
 */
export const alignRight = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'right', boundsChanged: false };
  }

  const bounds = elements.map(el => getElementBounds(el));
  const rightmost = Math.max(...bounds.map(b => b.right));

  const aligned = elements.map((el, idx) => {
    const currentRight = bounds[idx].right;
    const delta = rightmost - currentRight;
    return updateElementPosition(el, delta, 0);
  });

  logger.debug('alignmentUtils', 'Aligned right', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'right', boundsChanged: true };
};

/**
 * Align elements to center horizontally
 */
export const alignCenterH = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'centerH', boundsChanged: false };
  }

  const groupBounds = getGroupBounds(elements);
  const bounds = elements.map(el => getElementBounds(el));

  const aligned = elements.map((el, idx) => {
    const currentCenterX = bounds[idx].centerX;
    const delta = groupBounds.centerX - currentCenterX;
    return updateElementPosition(el, delta, 0);
  });

  logger.debug('alignmentUtils', 'Aligned center horizontally', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'centerH', boundsChanged: true };
};

/**
 * Align elements to top
 */
export const alignTop = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'top', boundsChanged: false };
  }

  const bounds = elements.map(el => getElementBounds(el));
  const topmost = Math.min(...bounds.map(b => b.top));

  const aligned = elements.map((el, idx) => {
    const currentTop = bounds[idx].top;
    const delta = topmost - currentTop;
    return updateElementPosition(el, 0, delta);
  });

  logger.debug('alignmentUtils', 'Aligned top', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'top', boundsChanged: true };
};

/**
 * Align elements to bottom
 */
export const alignBottom = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'bottom', boundsChanged: false };
  }

  const bounds = elements.map(el => getElementBounds(el));
  const bottommost = Math.max(...bounds.map(b => b.bottom));

  const aligned = elements.map((el, idx) => {
    const currentBottom = bounds[idx].bottom;
    const delta = bottommost - currentBottom;
    return updateElementPosition(el, 0, delta);
  });

  logger.debug('alignmentUtils', 'Aligned bottom', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'bottom', boundsChanged: true };
};

/**
 * Align elements to middle vertically
 */
export const alignMiddleV = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 2) {
    return { alignedElements: elements, alignmentType: 'middleV', boundsChanged: false };
  }

  const groupBounds = getGroupBounds(elements);
  const bounds = elements.map(el => getElementBounds(el));

  const aligned = elements.map((el, idx) => {
    const currentCenterY = bounds[idx].centerY;
    const delta = groupBounds.centerY - currentCenterY;
    return updateElementPosition(el, 0, delta);
  });

  logger.debug('alignmentUtils', 'Aligned middle vertically', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'middleV', boundsChanged: true };
};

/**
 * Distribute elements evenly horizontally
 */
export const distributeHorizontal = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 3) {
    return { alignedElements: elements, alignmentType: 'distributeH', boundsChanged: false };
  }

  // Sort by left position
  const sorted = [...elements].sort((a, b) => {
    const boundsA = getElementBounds(a);
    const boundsB = getElementBounds(b);
    return boundsA.left - boundsB.left;
  });

  const bounds = sorted.map(el => getElementBounds(el));
  const groupBounds = getGroupBounds(sorted);

  // Calculate total width of all elements
  const totalElementWidth = bounds.reduce((sum, b) => sum + b.width, 0);

  // Calculate total space available for gaps
  const totalSpace = groupBounds.width - totalElementWidth;
  const gapSize = totalSpace / (sorted.length - 1);

  // Position elements
  let currentX = groupBounds.left;
  const aligned = sorted.map((el, idx) => {
    const elBounds = bounds[idx];
    const delta = currentX - elBounds.left;
    currentX += elBounds.width + gapSize;

    return updateElementPosition(el, delta, 0);
  });

  logger.debug('alignmentUtils', 'Distributed horizontally', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'distributeH', boundsChanged: true };
};

/**
 * Distribute elements evenly vertically
 */
export const distributeVertical = (elements: DrawElement[]): AlignmentResult => {
  if (elements.length < 3) {
    return { alignedElements: elements, alignmentType: 'distributeV', boundsChanged: false };
  }

  // Sort by top position
  const sorted = [...elements].sort((a, b) => {
    const boundsA = getElementBounds(a);
    const boundsB = getElementBounds(b);
    return boundsA.top - boundsB.top;
  });

  const bounds = sorted.map(el => getElementBounds(el));
  const groupBounds = getGroupBounds(sorted);

  // Calculate total height of all elements
  const totalElementHeight = bounds.reduce((sum, b) => sum + b.height, 0);

  // Calculate total space available for gaps
  const totalSpace = groupBounds.height - totalElementHeight;
  const gapSize = totalSpace / (sorted.length - 1);

  // Position elements
  let currentY = groupBounds.top;
  const aligned = sorted.map((el, idx) => {
    const elBounds = bounds[idx];
    const delta = currentY - elBounds.top;
    currentY += elBounds.height + gapSize;

    return updateElementPosition(el, 0, delta);
  });

  logger.debug('alignmentUtils', 'Distributed vertically', { count: elements.length });
  return { alignedElements: aligned, alignmentType: 'distributeV', boundsChanged: true };
};

/**
 * Detect smart guides (alignment opportunities)
 */
export const detectSmartGuides = (
  elements: DrawElement[],
  threshold: number = 5
): SmartGuide[] => {
  const guides: SmartGuide[] = [];
  const bounds = elements.map((el, idx) => ({ ...getElementBounds(el), id: el.id, idx }));

  // Detect vertical alignment guides
  const xPositions: Map<number, string[]> = new Map();

  bounds.forEach(b => {
    // Check left edges
    const leftKey = Math.round(b.left / threshold) * threshold;
    if (!xPositions.has(leftKey)) xPositions.set(leftKey, []);
    xPositions.get(leftKey)!.push(b.id);

    // Check right edges
    const rightKey = Math.round(b.right / threshold) * threshold;
    if (!xPositions.has(rightKey)) xPositions.set(rightKey, []);
    xPositions.get(rightKey)!.push(b.id);

    // Check centers
    const centerKey = Math.round(b.centerX / threshold) * threshold;
    if (!xPositions.has(centerKey)) xPositions.set(centerKey, []);
    xPositions.get(centerKey)!.push(b.id);
  });

  // Detect horizontal alignment guides
  const yPositions: Map<number, string[]> = new Map();

  bounds.forEach(b => {
    // Check top edges
    const topKey = Math.round(b.top / threshold) * threshold;
    if (!yPositions.has(topKey)) yPositions.set(topKey, []);
    yPositions.get(topKey)!.push(b.id);

    // Check bottom edges
    const bottomKey = Math.round(b.bottom / threshold) * threshold;
    if (!yPositions.has(bottomKey)) yPositions.set(bottomKey, []);
    yPositions.get(bottomKey)!.push(b.id);

    // Check centers
    const centerKey = Math.round(b.centerY / threshold) * threshold;
    if (!yPositions.has(centerKey)) yPositions.set(centerKey, []);
    yPositions.get(centerKey)!.push(b.id);
  });

  // Create guides for positions with multiple elements
  xPositions.forEach((ids, pos) => {
    if (ids.length > 1) {
      guides.push({
        type: 'vertical',
        position: pos,
        elementIds: [...new Set(ids)],
        matchCount: new Set(ids).size,
      });
    }
  });

  yPositions.forEach((ids, pos) => {
    if (ids.length > 1) {
      guides.push({
        type: 'horizontal',
        position: pos,
        elementIds: [...new Set(ids)],
        matchCount: new Set(ids).size,
      });
    }
  });

  logger.debug('alignmentUtils', 'Smart guides detected', { count: guides.length });
  return guides;
};

/**
 * Snap element to nearest guide
 */
export const snapToGuide = (
  element: DrawElement,
  guides: SmartGuide[],
  snapDistance: number = 10
): DrawElement => {
  const bounds = getElementBounds(element);
  let deltaX = 0;
  let deltaY = 0;

  // Find closest vertical guide
  const verticalGuides = guides.filter(g => g.type === 'vertical');
  let closestVertical: SmartGuide | null = null;
  let minVerticalDistance = snapDistance;

  verticalGuides.forEach(guide => {
    // Check distance to element edges and center
    const distances = [
      Math.abs(bounds.left - guide.position),
      Math.abs(bounds.right - guide.position),
      Math.abs(bounds.centerX - guide.position),
    ];
    const minDistance = Math.min(...distances);

    if (minDistance < minVerticalDistance) {
      minVerticalDistance = minDistance;
      closestVertical = guide;
    }
  });

  // Find closest horizontal guide
  const horizontalGuides = guides.filter(g => g.type === 'horizontal');
  let closestHorizontal: SmartGuide | null = null;
  let minHorizontalDistance = snapDistance;

  horizontalGuides.forEach(guide => {
    // Check distance to element edges and center
    const distances = [
      Math.abs(bounds.top - guide.position),
      Math.abs(bounds.bottom - guide.position),
      Math.abs(bounds.centerY - guide.position),
    ];
    const minDistance = Math.min(...distances);

    if (minDistance < minHorizontalDistance) {
      minHorizontalDistance = minDistance;
      closestHorizontal = guide;
    }
  });

  // Apply snapping
  if (closestVertical) {
    deltaX = closestVertical.position - bounds.centerX;
  }

  if (closestHorizontal) {
    deltaY = closestHorizontal.position - bounds.centerY;
  }

  if (deltaX !== 0 || deltaY !== 0) {
    logger.debug('alignmentUtils', 'Snapped to guide', { deltaX, deltaY });
    return updateElementPosition(element, deltaX, deltaY);
  }

  return element;
};
