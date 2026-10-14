import { describe, expect, it } from 'vitest';
import { Geometry, Graph, Point } from '@maxgraph/core';
import { installDanglingEdgeStyles, installInheritStyleValues } from '../view-fixes';
import { parseDrawioStyle } from '../../../services/drawio-xml';

describe('installDanglingEdgeStyles', () => {
  it('routes an edge without terminals with its edge style, as draw.io does', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      installDanglingEdgeStyles(graph);
      const edge = graph.insertEdge(graph.getDefaultParent(), null, '', null, null,
        parseDrawioStyle('edgeStyle=elbowEdgeStyle;elbow=horizontal;endArrow=classic;html=1;'));
      const geo = new Geometry(0, 0, 50, 50);
      geo.relative = true;
      geo.setTerminalPoint(new Point(0, 100), true);
      geo.setTerminalPoint(new Point(100, 0), false);
      graph.getDataModel().setGeometry(edge, geo);
      const pts = graph.view.getState(edge)!.absolutePoints;
      // elbow: more than the two terminal points
      expect(pts.length).toBeGreaterThan(2);
    } finally {
      graph.destroy();
    }
  });
});

describe('installInheritStyleValues', () => {
  it("replaces 'inherit' with the parent's value", () => {
    const graph = new Graph(document.createElement('div'));
    try {
      installInheritStyleValues(graph);
      const parent = graph.insertVertex(graph.getDefaultParent(), null, '', 0, 0, 60, 60, parseDrawioStyle('strokeColor=none;'));
      const child = graph.insertVertex(parent, null, '', 0, 0, 60, 15, parseDrawioStyle('strokeColor=inherit;fillColor=inherit;'));
      const style = graph.getCellStyle(child) as Record<string, unknown>;
      expect(style.strokeColor).toBe('none');
      expect(style.fillColor).not.toBe('inherit');
    } finally {
      graph.destroy();
    }
  });
});
