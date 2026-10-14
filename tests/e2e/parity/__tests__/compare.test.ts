/**
 * @file compare.test.ts
 * @brief Unit tests for the draw.io parity comparison (synthetic PNGs).
 */

import { beforeAll, describe, it, it as vitestIt, expect } from 'vitest';
import { DEFAULT_MAX_SHIFT, classify, compareImages, contentBBox, loadImageDeps } from '../compare';
import type { ImageDeps, MatchFn } from '../compare';
import { createImage, decodePng, encodePng } from '../png';
import type { RgbaImage } from '../png';
import { edgeXml, parseMxLibraryNode, placeAtOrigin, vertexXml } from '../entries';
import { deflateRawSync } from 'node:zlib';

function square(size: number, x: number, y: number, side: number, color: [number, number, number] = [0, 0, 0]): RgbaImage {
  const img = createImage(size, size);
  for (let j = y; j < y + side; j++) {
    for (let i = x; i < x + side; i++) {
      const o = (j * size + i) * 4;
      img.data[o] = color[0];
      img.data[o + 1] = color[1];
      img.data[o + 2] = color[2];
    }
  }
  return img;
}

function triangle(size: number, x: number, y: number, side: number): RgbaImage {
  const img = createImage(size, size);
  for (let j = 0; j < side; j++) {
    for (let i = 0; i <= j; i++) {
      const o = ((y + j) * size + x + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 0;
    }
  }
  return img;
}

/** Round-trip through PNG bytes, like the spec does with data URIs. */
function viaPng(img: RgbaImage): RgbaImage {
  return decodePng(encodePng(img));
}

let deps: ImageDeps;
beforeAll(async () => {
  deps = await loadImageDeps();
});

/** 'builtin' always runs; 'pixelmatch' runs when the optional package is installed. */
type MatcherCase = [string, () => MatchFn | undefined | null];
const matchers: MatcherCase[] = [
  ['builtin', () => undefined],
  ['pixelmatch', () => deps.pixelmatch],
];

describe('png codec', () => {
  it('round-trips RGBA pixels', () => {
    const img = square(16, 3, 4, 5, [12, 200, 77]);
    const back = viaPng(img);
    expect(back.width).toBe(16);
    expect(back.height).toBe(16);
    expect(Array.from(back.data)).toEqual(Array.from(img.data));
  });

  it('decodes through pngjs when installed', () => {
    const img = square(8, 1, 1, 3);
    expect(Array.from(deps.decode(deps.encode(img)).data)).toEqual(Array.from(img.data));
  });
});

describe.each(matchers)('compareImages (%s)', (_name, getMatch) => {
  /** Defines a test that receives the matcher, skipped when pixelmatch is not installed. */
  const it = (name: string, fn: (match: MatchFn | undefined) => void): void => {
    vitestIt(name, (ctx) => {
      const m = getMatch();
      if (m === null) ctx.skip();
      fn(m ?? undefined);
    });
  };

  it('identical images give 0', (match) => {
    const a = viaPng(square(64, 10, 10, 20));
    const r = compareImages(a, viaPng(square(64, 10, 10, 20)), { match });
    expect(r.diffRatio).toBe(0);
    expect(r.diffPixels).toBe(0);
    expect(r.contentPixels).toBe(400);
    expect(r.sizeDelta).toEqual({ width: 0, height: 0 });
    expect(classify(r.diffRatio)).toBe('pass');
  });

  it('a square shifted by 1px still passes after trimming', (match) => {
    const r = compareImages(viaPng(square(64, 10, 10, 20)), viaPng(square(64, 11, 11, 20)), { match });
    expect(r.diffRatio).toBe(0);
    expect(classify(r.diffRatio)).toBe('pass');
  });

  it('a different shape fails', (match) => {
    const r = compareImages(viaPng(square(64, 10, 10, 20)), viaPng(triangle(64, 10, 10, 20)), { match });
    expect(r.diffRatio).toBeGreaterThan(0.06);
    expect(classify(r.diffRatio)).toBe('fail');
    expect(classify(r.diffRatio, true)).toBe('expected');
  });

  it('reports the size delta of the trimmed content', (match) => {
    const r = compareImages(square(64, 10, 10, 20), square(64, 10, 10, 24), { match });
    expect(r.sizeDelta).toEqual({ width: 4, height: 4 });
    // the comparison canvas has DEFAULT_MAX_SHIFT px of room on each side for the alignment search
    expect(r.width).toBe(24 + 2 * DEFAULT_MAX_SHIFT);
  });

  it('forgives edges displaced by one pixel (anti-aliasing, half-pixel placement)', (match) => {
    // 2px outline of a 30x20 box vs the same box one pixel wider: only the right edge moves
    const outline = (w: number): RgbaImage => {
      const img = createImage(64, 64);
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 10 + w; x++) {
          if (x < 12 || x >= 8 + w || y < 12 || y >= 28) {
            const o = (y * 64 + x) * 4;
            img.data[o] = img.data[o + 1] = img.data[o + 2] = 0;
          }
        }
      }
      return img;
    };
    const r = compareImages(viaPng(outline(30)), viaPng(outline(31)), { match });
    expect(r.diffRatio).toBe(0);
    expect(r.strictDiffPixels).toBeGreaterThan(0);
  });

  it('still fails a missing part', (match) => {
    const a = square(64, 10, 10, 20);
    const b = square(64, 10, 10, 20);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) b.data[(y * 64 + x) * 4] = 255;
    const r = compareImages(viaPng(a), viaPng(b), { match });
    expect(classify(r.diffRatio)).toBe('fail');
  });

  it('one blank side gives ratio 1, two blank sides give 0', (match) => {
    expect(compareImages(createImage(10, 10), square(10, 2, 2, 3), { match }).diffRatio).toBe(1);
    const both = compareImages(createImage(10, 10), createImage(10, 10), { match });
    expect(both.blank).toBe('both');
    expect(both.diffRatio).toBe(0);
  });
});

describe('classify', () => {
  it('uses 2 % / 6 % thresholds', () => {
    expect(classify(0.02)).toBe('pass');
    expect(classify(0.021)).toBe('warn');
    expect(classify(0.06)).toBe('warn');
    expect(classify(0.061)).toBe('fail');
  });
});

describe('contentBBox', () => {
  it('treats transparent pixels as background', () => {
    const img = createImage(8, 8, [0, 0, 0, 0]);
    expect(contentBBox(img)).toBeNull();
    expect(contentBBox(square(8, 2, 3, 2))).toEqual({ x: 2, y: 3, width: 2, height: 2 });
  });
});

describe('entries', () => {
  it('builds vertex and edge models at (20,20)', () => {
    expect(vertexXml('ellipse;', 'a"b', 80, 40)).toContain('<mxGeometry x="20" y="20" width="80" height="40" as="geometry"/>');
    expect(vertexXml('ellipse;', 'a"b', 80, 40)).toContain('value="a&quot;b"');
    const edge = edgeXml('endArrow=classic;', '', 50, 50);
    expect(edge).toContain('<mxPoint x="20" y="70" as="sourcePoint"/>');
    expect(edge).toContain('<mxPoint x="70" y="20" as="targetPoint"/>');
  });

  it('moves layer-1 cells of a composite to (20,20) and leaves children alone', () => {
    const xml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="2" style="group" vertex="1" parent="1"><mxGeometry x="100" y="50" width="40" height="20" as="geometry"/></mxCell>' +
      '<mxCell id="3" style="rect" vertex="1" parent="2"><mxGeometry x="5" y="5" width="10" height="10" as="geometry"/></mxCell>' +
      '<mxCell id="4" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="90" y="60" as="sourcePoint"/><mxPoint x="1" y="2" as="offset"/></mxGeometry></mxCell>' +
      '</root></mxGraphModel>';
    const out = placeAtOrigin(xml);
    expect(out).toContain('<mxGeometry x="30" y="20" width="40" height="20" as="geometry"/>');
    expect(out).toContain('<mxGeometry x="5" y="5" width="10" height="10" as="geometry"/>');
    expect(out).toContain('<mxPoint x="20" y="30" as="sourcePoint"/>');
    expect(out).toContain('<mxPoint x="1" y="2" as="offset"/>');
  });

  it('parses an mxlibrary with plain, escaped and compressed xml', () => {
    const model = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
    const compressed = deflateRawSync(Buffer.from(encodeURIComponent(model), 'latin1')).toString('base64');
    const json = JSON.stringify([
      { xml: model, w: 10, h: 20, title: 'plain' },
      { xml: compressed, w: 30, h: 40, title: 'compressed' },
    ]);
    const lib = `<mxlibrary>${json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</mxlibrary>`;
    const entries = parseMxLibraryNode(lib);
    expect(entries.map((e) => e.xml)).toEqual([model, model]);
    expect(entries[1]).toMatchObject({ title: 'compressed', w: 30, h: 40 });
  });
});
