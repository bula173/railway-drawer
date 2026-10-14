/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:8082
 * (CurvedTextShape, registered at :8406) and the graph hooks at
 * Shapes.js:10383-10477 (preferred size, placeholder repaint, editing repaint).
 */

import {
  AbstractCanvas2D,
  CellState,
  Graph,
  ObjectIdentity,
  Rectangle,
  RectangleShape,
  constants,
  styleUtils,
} from '@maxgraph/core';
import { getNumber, getString, parseCssFontFamily } from './util';

const FONT_BOLD = 1;
const FONT_ITALIC = 2;
const FONT_UNDERLINE = 4;
const FONT_STRIKETHROUGH = 8;
/** draw.io mxConstants.FONT_UNDERLINE_DOTTED (not in maxGraph 0.10). */
const FONT_UNDERLINE_DOTTED = 16;
/** CurvedTextShape.prototype.arcMidY, the default range of the mid offset. */
const DEFAULT_ARC_MID_Y = -25;

interface SvgLikeCanvas {
  root: Element | null;
  state: { dx: number; dy: number; scale: number; alpha: number; transform: string | null };
  format(v: number): number;
  getBaseUrl(): string;
  createElement(name: string): Element;
  idPrefix?: string;
}

function getEditingCell(graph: Graph): unknown {
  try {
    const editor = graph.getPlugin('CellEditorHandler') as unknown as { getEditingCell?: () => unknown; editingCell?: unknown } | undefined;
    return editor?.getEditingCell?.() ?? editor?.editingCell ?? null;
  } catch {
    return null;
  }
}

/** draw.io `shape=curvedText`: renders the cell label along an arc or curve. */
export class CurvedTextShape extends RectangleShape {
  arcStartY = 25;

  arcMidY = DEFAULT_ARC_MID_Y;

  arcEndY = 25;

  /** Group of the last repaint (removed on the next one and in destroy). */
  curvedTextGroup: Element | null = null;

  /** Vertical offset of the curve for handle synchronization. */
  curveYOffset = 0;

  constructor() {
    super(new Rectangle(), constants.NONE, constants.NONE);
  }

  override paintForeground(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    super.paintForeground(c, x, y, w, h);

    if (this.state == null) {
      return;
    }

    const graph = this.state.view.graph;

    // Hide curved text while editing
    if (getEditingCell(graph) === this.state.cell) {
      return;
    }

    const label = graph.convertValueToString(this.state.cell);

    if (label == null || label.length === 0) {
      return;
    }

    const startY = getNumber(this.style, 'arcStartY', this.arcStartY);
    let midYOffset = getNumber(this.style, 'arcMidY', this.arcMidY);
    const endY = getNumber(this.style, 'arcEndY', this.arcEndY);
    const curveType = getString(this.style, 'curveType', 'round');
    const svg = c as unknown as SvgLikeCanvas;

    // SVG textPath rendering (requires an SVG canvas)
    if (svg.root != null && typeof svg.getBaseUrl === 'function') {
      // Remove previous custom group from prior repaint
      if (this.curvedTextGroup != null && this.curvedTextGroup.parentNode != null) {
        this.curvedTextGroup.parentNode.removeChild(this.curvedTextGroup);
      }

      this.curvedTextGroup = null;

      c.translate(x, y);
      const s = svg.state;

      const fontSize = getNumber(this.style, 'fontSize', constants.DEFAULT_FONTSIZE);

      // Inset path by half font size to keep text inside bounds
      const inset = fontSize / 2;

      // Natural curve geometry (independent of cell height)
      const chordMid = (startY + endY) / 2;

      // Clamp mid symmetrically
      const defaultMid = Math.abs(DEFAULT_ARC_MID_Y);
      const maxMid = Math.max(defaultMid, Math.min(chordMid, h - chordMid));
      midYOffset = Math.max(-maxMid, Math.min(maxMid, midYOffset));

      const naturalMidY = chordMid + midYOffset;

      // Curve's natural bounding box
      const curveTopY = Math.min(startY, endY, naturalMidY);
      const curveBottomY = Math.max(startY, endY, naturalMidY);
      const curveNaturalHeight = curveBottomY - curveTopY;

      // Vertical alignment positions curve within cell
      const verticalAlign = getString(this.style, 'verticalAlign', 'middle');
      const padding = inset;
      let yOffset: number;

      if (verticalAlign === 'top') {
        yOffset = padding - curveTopY;
      } else if (verticalAlign === 'bottom') {
        yOffset = h - padding - curveBottomY;
      } else {
        yOffset = (h - curveNaturalHeight) / 2 - curveTopY;
      }

      this.curveYOffset = yOffset;

      const lx0 = inset;
      const ly0 = startY + yOffset;
      const lx2 = w - inset;
      const ly2 = endY + yOffset;
      const lx1 = (lx0 + lx2) / 2;
      const ly1 = naturalMidY + yOffset;

      // Convert to screen coordinates
      const sx0 = (lx0 + s.dx) * s.scale;
      const sy0 = (ly0 + s.dy) * s.scale;
      const sx1 = (lx1 + s.dx) * s.scale;
      const sy1 = (ly1 + s.dy) * s.scale;
      const sx2 = (lx2 + s.dx) * s.scale;
      const sy2 = (ly2 + s.dy) * s.scale;
      const f = (v: number): number => svg.format(v);

      let pathD: string;
      let pathLen: number;

      if (curveType === 'round') {
        // Circular arc mode
        const chord = Math.sqrt((sx2 - sx0) * (sx2 - sx0) + (sy2 - sy0) * (sy2 - sy0));
        const chordMidX = (sx0 + sx2) / 2;
        const chordMidY = (sy0 + sy2) / 2;
        const sag = Math.sqrt((sx1 - chordMidX) * (sx1 - chordMidX) + (sy1 - chordMidY) * (sy1 - chordMidY));

        if (sag < 0.5) {
          pathD = `M ${f(sx0)} ${f(sy0)} L ${f(sx2)} ${f(sy2)}`;
          pathLen = chord;
        } else {
          const halfChord = chord / 2;
          const radius = (halfChord * halfChord) / (2 * sag) + sag / 2;

          // Sweep direction: arc must curve toward the control point
          const cdx = sx2 - sx0;
          const cdy = sy2 - sy0;
          const pdx = sx1 - sx0;
          const pdy = sy1 - sy0;
          const cross = cdx * pdy - cdy * pdx;
          const sweep = cross > 0 ? 0 : 1;

          // When sagitta exceeds half-chord, the arc spans > 180°
          const largeArc = sag > halfChord ? 1 : 0;

          pathD = `M ${f(sx0)} ${f(sy0)} A ${f(radius)} ${f(radius)} 0 ${largeArc} ${sweep} ${f(sx2)} ${f(sy2)}`;

          const sinVal = Math.min(1, halfChord / radius);
          let theta = 2 * Math.asin(sinVal);

          if (largeArc) {
            theta = 2 * Math.PI - theta;
          }

          pathLen = radius * theta;
        }
      } else {
        // Quadratic Bezier mode
        pathD = `M ${f(sx0)} ${f(sy0)} Q ${f(sx1)} ${f(sy1)} ${f(sx2)} ${f(sy2)}`;

        const dx01 = sx1 - sx0;
        const dy01 = sy1 - sy0;
        const dx12 = sx2 - sx1;
        const dy12 = sy2 - sy1;
        const dx02 = sx2 - sx0;
        const dy02 = sy2 - sy0;
        pathLen = (Math.sqrt(dx01 * dx01 + dy01 * dy01) +
          Math.sqrt(dx12 * dx12 + dy12 * dy12) +
          Math.sqrt(dx02 * dx02 + dy02 * dy02)) / 2;
      }

      // Unique path ID (object identity avoids collisions across graphs)
      const pathId = `${svg.idPrefix ?? ''}ctp-${ObjectIdentity.get(this as unknown as object) ?? ''}`;
      const doc = svg.root.ownerDocument;
      const useBaseUrl = typeof document !== 'undefined' && doc === document;
      const base = useBaseUrl ? svg.getBaseUrl().replace(/([()])/g, '\\$1') : '';

      // Group with rotation/flip transform
      const group = svg.createElement('g');
      const tr = s.transform || '';

      if (tr.length > 0) {
        group.setAttribute('transform', tr);
      }

      if (s.alpha < 1) {
        group.setAttribute('opacity', String(s.alpha));
      }

      // Path definition in local defs
      const defs = svg.createElement('defs');
      const path = svg.createElement('path');
      path.setAttribute('id', pathId);
      path.setAttribute('d', pathD);
      defs.appendChild(path);
      group.appendChild(defs);

      // Text element
      const text = svg.createElement('text') as SVGElement;
      const fontFamily = getString(this.style, 'fontFamily', constants.DEFAULT_FONTFAMILY);
      const fontColor = getString(this.style, 'fontColor', '#000000');
      const fontStyle = getNumber(this.style, 'fontStyle', 0);

      text.setAttribute('font-size', `${fontSize * s.scale}px`);
      text.setAttribute('font-family', parseCssFontFamily(fontFamily));
      text.setAttribute('fill', fontColor);

      if ((fontStyle & FONT_BOLD) === FONT_BOLD) {
        text.setAttribute('font-weight', 'bold');
      }

      if ((fontStyle & FONT_ITALIC) === FONT_ITALIC) {
        text.setAttribute('font-style', 'italic');
      }

      const txtDecor: string[] = [];

      if ((fontStyle & FONT_UNDERLINE) === FONT_UNDERLINE) {
        txtDecor.push('underline');
      }

      if ((fontStyle & FONT_STRIKETHROUGH) === FONT_STRIKETHROUGH) {
        txtDecor.push('line-through');
      }

      if (txtDecor.length > 0) {
        text.setAttribute('text-decoration', txtDecor.join(' '));

        if ((fontStyle & FONT_UNDERLINE_DOTTED) === FONT_UNDERLINE_DOTTED && text.style != null) {
          text.style.textDecorationStyle = 'dotted';
        }
      }

      // Alignment
      const align = getString(this.style, 'align', 'center');
      let anchor = 'middle';
      let offset = '50%';

      if (align === 'left') {
        anchor = 'start';
        offset = '0%';
      } else if (align === 'right') {
        anchor = 'end';
        offset = '100%';
      }

      text.setAttribute('text-anchor', anchor);
      text.setAttribute('dominant-baseline', 'central');

      // textPath element
      const textPath = svg.createElement('textPath');
      textPath.setAttribute('startOffset', offset);

      const hrefVal = `${useBaseUrl ? base : ''}#${pathId}`;
      textPath.setAttribute('href', hrefVal);

      if (useBaseUrl) {
        textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', hrefVal);
      }

      // Always set textLength so spacing adjusts smoothly with path length
      textPath.setAttribute('textLength', String(pathLen));
      textPath.setAttribute('lengthAdjust', 'spacing');

      textPath.appendChild((doc ?? document).createTextNode(label));
      text.appendChild(textPath);
      group.appendChild(text);
      svg.root.appendChild(group);
      this.curvedTextGroup = group;
    } else {
      // Fallback for non-SVG canvas: render as plain centered text
      (c as unknown as { text: (...args: unknown[]) => void }).text(x + w / 2, y + h / 2, 0, 0, label,
        'center', 'middle', false, '', null, false, 0, null);
    }
  }

  override destroy(): void {
    if (this.curvedTextGroup != null && this.curvedTextGroup.parentNode != null) {
      this.curvedTextGroup.parentNode.removeChild(this.curvedTextGroup);
    }

    this.curvedTextGroup = null;
    super.destroy();
  }
}

/** True if the given state is painted by CurvedTextShape. */
function isCurvedText(state: CellState | null | undefined): boolean {
  return state?.style != null && (state.style as Record<string, unknown>).shape === 'curvedText';
}

const CURVED_TEXT_INSTALLED = Symbol.for('rd.drawio.curvedTextSupport');

/**
 * Graph hooks of Shapes.js:10383-10477 on the given graph instance (never on
 * the prototypes): preferred size from the label, repaint on value changes
 * and while editing starts/stops. Idempotent.
 */
export function installCurvedTextSupport(graph: Graph): void {
  const g = graph as unknown as Record<string | symbol, unknown>;

  if (g[CURVED_TEXT_INSTALLED]) {
    return;
  }

  g[CURVED_TEXT_INSTALLED] = true;

  // Autosize: straight text width reduced as the arc is longer than its chord
  const origGetPreferredSize = graph.getPreferredSizeForCell.bind(graph);
  graph.getPreferredSizeForCell = function (cell, textWidth) {
    const style = graph.getCellStyle(cell) as Record<string, unknown>;

    if (style != null && style.shape === 'curvedText') {
      const label = graph.convertValueToString(cell);

      if (label != null && label.length > 0) {
        const fontSize = getNumber(style, 'fontSize', constants.DEFAULT_FONTSIZE);
        const fontFamily = getString(style, 'fontFamily', constants.DEFAULT_FONTFAMILY);
        const fontStyle = getNumber(style, 'fontStyle', 0);
        const size = styleUtils.getSizeForString(label, fontSize, fontFamily, null, fontStyle);
        let width = size.width * 0.85;
        const geo = cell.getGeometry();
        const h = geo != null ? geo.height : 60;

        if (graph.isGridEnabled()) {
          width = graph.snap(width + graph.getGridSize() / 2);
        }

        return new Rectangle(0, 0, Math.max(width, 2 * fontSize) + 10, h);
      }

      return null;
    }

    return origGetPreferredSize(cell, textWidth);
  };

  // Forces repaint of curvedText shapes when the cell value changes
  const renderer = graph.cellRenderer;
  const origCheck = renderer.checkPlaceholderStyles.bind(renderer);
  renderer.checkPlaceholderStyles = function (state: CellState) {
    return isCurvedText(state) || origCheck(state);
  };

  // Redraws curvedText shapes when editing starts/stops
  const redrawFor = (cell: unknown): void => {
    if (cell == null) return;
    const state = graph.view.getState(cell as never);
    if (state != null && isCurvedText(state) && state.shape != null) {
      state.shape.redraw();
    }
  };

  try {
    const editor = graph.getPlugin('CellEditorHandler') as unknown as {
      startEditing?: (cell: unknown, trigger?: unknown) => void;
      stopEditing?: (cancel?: boolean) => void;
      getEditingCell?: () => unknown;
      editingCell?: unknown;
    } | undefined;

    if (editor?.startEditing != null && editor.stopEditing != null) {
      const origStart = editor.startEditing.bind(editor);
      editor.startEditing = function (cell: unknown, trigger?: unknown) {
        origStart(cell, trigger);
        redrawFor(cell);
      };

      const origStop = editor.stopEditing.bind(editor);
      editor.stopEditing = function (cancel?: boolean) {
        const cell = editor.getEditingCell?.() ?? editor.editingCell;
        origStop(cancel);
        redrawFor(cell);
      };
    }
  } catch {
    // Graph without a cell editor plugin
  }
}
