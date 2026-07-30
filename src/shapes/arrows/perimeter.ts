/**
 * Perimeter calculations for SVG arrow shapes
 *
 * Defines how connectors attach to SVG arrow boundaries instead of the
 * rectangular bounding box. Each arrow type has a custom perimeter function
 * that calculates connection points based on the arrow's actual geometry.
 */

import { Rectangle, Point, CellState } from '@maxgraph/core';
import type { PerimeterFunction } from '@maxgraph/core';

/**
 * Wide arrow perimeter - connection points match wide arrow geometry
 */
export const wideArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  next: Point,
  _orthogonal: boolean = false
): Point => {
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const w = bounds.width;

  const dx = next.x - cx;
  const dy = next.y - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirX = distance > 0 ? dx / distance : 1;

  const rightTip = bounds.x + (30.5 / 32) * w;
  const leftBase = bounds.x + (1.5 / 32) * w;

  if (dirX > 0) {
    return new Point(rightTip, cy);
  } else {
    return new Point(leftBase, cy);
  }
};

/**
 * Thin arrow perimeter
 */
export const thinArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  next: Point,
  _orthogonal: boolean = false
): Point => {
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const w = bounds.width;

  const dx = next.x - cx;
  const dy = next.y - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirX = distance > 0 ? dx / distance : 1;

  const rightTip = bounds.x + (30.5 / 32) * w;
  const leftBase = bounds.x + (1.5 / 32) * w;

  if (dirX > 0) {
    return new Point(rightTip, cy);
  } else {
    return new Point(leftBase, cy);
  }
};

/**
 * Double arrow perimeter - symmetric connection on both ends
 */
export const doubleArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  next: Point,
  _orthogonal: boolean = false
): Point => {
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const w = bounds.width;

  const dx = next.x - cx;
  const dy = next.y - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirX = distance > 0 ? dx / distance : 1;

  const leftTip = bounds.x + (1.5 / 32) * w;
  const rightTip = bounds.x + (30.5 / 32) * w;

  if (dirX > 0) {
    return new Point(rightTip, cy);
  } else {
    return new Point(leftTip, cy);
  }
};

/**
 * Split arrow perimeter - connect to split openings
 */
export const splitArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  next: Point,
  _orthogonal: boolean = false
): Point => {
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const w = bounds.width;
  const h = bounds.height;

  const dx = next.x - cx;
  const dy = next.y - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirY = distance > 0 ? dy / distance : 0;

  const rightTip = bounds.x + (30.5 / 32) * w;
  const topSplit = bounds.y + (9.2 / 30) * h;
  const bottomSplit = bounds.y + (20.8 / 30) * h;

  if (dirY < 0) {
    return new Point(rightTip, topSplit);
  } else {
    return new Point(rightTip, bottomSplit);
  }
};

/**
 * Chevron arrow perimeter - connect to chevron points
 */
export const chevronArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  next: Point,
  _orthogonal: boolean = false
): Point => {
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const w = bounds.width;
  const h = bounds.height;

  const dx = next.x - cx;
  const dy = next.y - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirY = distance > 0 ? dy / distance : 0;

  const rightTip = bounds.x + (29.5 / 32) * w;

  // Top chevron
  if (dirY < -0.1) {
    return new Point(rightTip, bounds.y + (9.6 / 30) * h);
  }
  // Bottom chevron
  else if (dirY > 0.1) {
    return new Point(rightTip, bounds.y + (20.4 / 30) * h);
  }
  // Center
  else {
    return new Point(rightTip, cy);
  }
};

/**
 * Loop arrow perimeter - connect at the opening
 */
export const loopArrowPerimeter: PerimeterFunction = (
  bounds: Rectangle,
  _vertex: CellState,
  _next: Point,
  _orthogonal: boolean = false
): Point => {
  const cy = bounds.getCenterY();
  const w = bounds.width;

  const rightTip = bounds.x + (29.5 / 32) * w;
  return new Point(rightTip, cy);
};
