import { describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import { installDrawioHtmlLabels, sanitizeHtmlLabel } from '../html-labels';

describe('sanitizeHtmlLabel', () => {
  it('keeps formatting markup', () => {
    const html = '<div style="font-size: 1px"><font color="#ff0000">S4</font><br><b>x</b></div>';
    expect(sanitizeHtmlLabel(html)).toBe(html);
  });

  it('removes scripting', () => {
    const out = sanitizeHtmlLabel(
      '<img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">a</a>' +
        '<a href=" JaVa\tscript:alert(4)">b</a><iframe src="https://example.com"></iframe>' +
        '<svg onload="alert(5)"><a xlink:href="javascript:alert(6)"></a></svg><img src="data:text/html,x">'
    );
    expect(out).not.toMatch(/onerror|onload|<script|javascript|<iframe|data:text/i);
    expect(out).toContain('<img src="x">');
  });

  it('keeps image data URLs and plain text', () => {
    expect(sanitizeHtmlLabel('<img src="data:image/png;base64,AAAA">')).toBe('<img src="data:image/png;base64,AAAA">');
    expect(sanitizeHtmlLabel('plain text')).toBe('plain text');
  });
});

describe('installDrawioHtmlLabels', () => {
  it('treats html=1 cells as HTML labels (sanitized) and others as the graph decides', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      installDrawioHtmlLabels(graph);
      installDrawioHtmlLabels(graph);
      const parent = graph.getDefaultParent();
      const html = graph.insertVertex(parent, null, '<b onclick="x()">S4</b>', 0, 0, 10, 10, { html: true } as never);
      const plain = graph.insertVertex(parent, null, '<b>S4</b>', 0, 0, 10, 10, {});
      expect(graph.isHtmlLabel(html)).toBe(true);
      expect(graph.getLabel(html)).toBe('<b>S4</b>');
      expect(graph.isHtmlLabel(plain)).toBe(false);
      expect(graph.getLabel(plain)).toBe('<b>S4</b>');
    } finally {
      graph.destroy();
    }
  });
});
