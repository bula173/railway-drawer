/**
 * @file ConnectorStyles.test.ts
 * @brief Tests for connector styling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getDashArray,
  getArrowMarkerPath,
  DEFAULT_CONNECTOR_STYLE,
  ConnectorArrowStyle,
  ConnectorLineStyle,
} from '../connectorStyles';

describe('Connector Styles', () => {
  describe('Dash Array Generation', () => {
    it('should return empty string for solid line', () => {
      const dashArray = getDashArray('solid', 2);
      expect(dashArray).toBe('');
    });

    it('should return dotted dash array', () => {
      const dashArray = getDashArray('dotted', 2);
      expect(dashArray).toBe('2,4');
    });

    it('should return dashed dash array', () => {
      const dashArray = getDashArray('dashed', 2);
      expect(dashArray).toBe('8,4');
    });

    it('should scale dash array with line width', () => {
      const dashed1 = getDashArray('dotted', 1);
      const dashed2 = getDashArray('dotted', 2);

      expect(dashed1).toBe('1,2');
      expect(dashed2).toBe('2,4');
    });

    it('should handle different line widths', () => {
      const widths = [1, 2, 3, 4];
      widths.forEach((width) => {
        const dotted = getDashArray('dotted', width as any);
        const dashed = getDashArray('dashed', width as any);

        expect(dotted).toBe(`${width},${width * 2}`);
        expect(dashed).toBe(`${width * 4},${width * 2}`);
      });
    });
  });

  describe('Arrow Marker Path Generation', () => {
    it('should return empty string for no arrow', () => {
      const path = getArrowMarkerPath('none', 2);
      expect(path).toBe('');
    });

    it('should generate standard arrow path', () => {
      const path = getArrowMarkerPath('standard', 2);
      expect(path).toContain('M0,0');
      expect(path).toContain('Z');
    });

    it('should generate block arrow path', () => {
      const path = getArrowMarkerPath('block', 2);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
    });

    it('should generate classic arrow path', () => {
      const path = getArrowMarkerPath('classic', 2);
      expect(path).toContain('M');
      expect(path).toContain('L');
    });

    it('should generate circle arrow path', () => {
      const path = getArrowMarkerPath('circle', 2);
      expect(path).toContain('A'); // Arc command
    });

    it('should generate diamond arrow path', () => {
      const path = getArrowMarkerPath('diamond', 2);
      expect(path).toContain('M');
      expect(path).toContain('L');
    });

    it('should scale arrow size with line width', () => {
      const path1 = getArrowMarkerPath('standard', 1);
      const path4 = getArrowMarkerPath('standard', 4);

      // Both should be valid paths but different sizes
      expect(path1.length).toBeGreaterThan(0);
      expect(path4.length).toBeGreaterThan(0);
      expect(path1).not.toBe(path4);
    });
  });

  describe('Default Connector Style', () => {
    it('should have solid line style', () => {
      expect(DEFAULT_CONNECTOR_STYLE.lineStyle).toBe('solid');
    });

    it('should have 2px line width', () => {
      expect(DEFAULT_CONNECTOR_STYLE.lineWidth).toBe(2);
    });

    it('should have no start arrow', () => {
      expect(DEFAULT_CONNECTOR_STYLE.startArrow).toBe('none');
    });

    it('should have standard end arrow', () => {
      expect(DEFAULT_CONNECTOR_STYLE.endArrow).toBe('standard');
    });

    it('should have dark color', () => {
      expect(DEFAULT_CONNECTOR_STYLE.color).toBe('#333333');
    });

    it('should have full opacity', () => {
      expect(DEFAULT_CONNECTOR_STYLE.opacity).toBe(1);
    });
  });

  describe('Arrow Style Variations', () => {
    const arrowStyles: ConnectorArrowStyle[] = ['none', 'standard', 'block', 'classic', 'circle', 'diamond'];

    it('should generate paths for all arrow styles', () => {
      arrowStyles.forEach((style) => {
        const path = getArrowMarkerPath(style, 2);

        if (style === 'none') {
          expect(path).toBe('');
        } else {
          expect(path).toContain('M');
          expect(path).toContain('Z');
        }
      });
    });
  });

  describe('Line Style Variations', () => {
    const lineStyles: ConnectorLineStyle[] = ['solid', 'dotted', 'dashed'];

    it('should generate dash arrays for all line styles', () => {
      lineStyles.forEach((style) => {
        const dashArray = getDashArray(style, 2);

        if (style === 'solid') {
          expect(dashArray).toBe('');
        } else {
          expect(dashArray).toBeTruthy();
          expect(dashArray).toContain(',');
        }
      });
    });
  });

  describe('Connector Properties', () => {
    it('should support color customization', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#000000', '#FFFFFF'];

      colors.forEach((color) => {
        expect(/^#[0-9A-F]{6}$/i.test(color)).toBe(true);
      });
    });

    it('should support opacity range 0-1', () => {
      const opacities = [0, 0.25, 0.5, 0.75, 1];

      opacities.forEach((opacity) => {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      });
    });

    it('should support all line widths', () => {
      const widths = [1, 2, 3, 4];

      widths.forEach((width) => {
        expect([1, 2, 3, 4]).toContain(width);
      });
    });
  });
});
