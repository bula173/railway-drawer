/**
 * @file compare.ts
 * @brief Image comparison for the draw.io parity harness.
 *
 * Both renders are trimmed to their non-white content box, padded to a common size aligned
 * at the top-left of that box, and aligned within ±DEFAULT_MAX_SHIFT px (the offset with the
 * fewest differing pixels wins). A pixel differs when its YIQ colour distance exceeds
 * pixelmatch's (threshold 0.1) and the other image has no pixel of that colour within
 * DEFAULT_TOLERANCE px (checked both ways): two browsers' renderers place and anti-alias the
 * same edge up to a pixel apart, and at stroke widths of 2 px that alone would otherwise count
 * as ~50 % of the content. diffRatio = differing pixels / content pixels, where content pixels
 * are the pixels that are non-white in at least one of the two images. pixelmatch (when
 * installed) gives the strict count (`strictDiffPixels`) for reference.
 *
 * `pixelmatch` and `pngjs` are optional devDependencies loaded at runtime
 * (loadImageDeps). Without pngjs the built-in codec in png.ts is used; without
 * pixelmatch the spec skips, while unit tests use the built-in YIQ matcher
 * (same color metric as pixelmatch, but without anti-aliasing detection).
 */

import { createImage, decodePng, encodePng } from './png';
import type { RgbaImage } from './png';

export type { RgbaImage } from './png';

/** pixelmatch's signature (img1, img2, output, width, height, options) → differing pixel count. */
export type MatchFn = (
  img1: Uint8Array,
  img2: Uint8Array,
  output: Uint8Array | null,
  width: number,
  height: number,
  options: { threshold: number; includeAA?: boolean }
) => number;

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ParityStatus = 'pass' | 'warn' | 'fail' | 'expected' | 'error';

export const THRESHOLDS = { pass: 0.02, warn: 0.06 } as const;
export const PIXELMATCH_THRESHOLD = 0.1;
/** Edge displacement forgiven between the two renderers (anti-aliasing, half-pixel placement). */
export const DEFAULT_TOLERANCE = 1;
/** Alignment search range: both content boxes are trimmed, but their origins can round differently. */
export const DEFAULT_MAX_SHIFT = 2;

export interface CompareResult {
  /** differing pixels / content pixels (0..1); 1 when exactly one side is blank. */
  diffRatio: number;
  /** Pixels that differ beyond the tolerance radius (the ratio's numerator). */
  diffPixels: number;
  /** Pixels that differ at all (pixelmatch, or the built-in matcher) at the chosen alignment. */
  strictDiffPixels: number;
  contentPixels: number;
  /** Size of the padded comparison canvas. */
  width: number;
  height: number;
  drawioSize: { width: number; height: number };
  appSize: { width: number; height: number };
  /** app content size minus draw.io content size, in pixels. */
  sizeDelta: { width: number; height: number };
  blank: 'none' | 'drawio' | 'app' | 'both';
  diff: RgbaImage;
}

export interface CompareOptions {
  threshold?: number;
  /** Channel distance from white (0..255) below which a pixel counts as background. */
  whiteTolerance?: number;
  /** Radius in px within which a differing pixel may find its colour in the other image (default 1). */
  tolerance?: number;
  /** Largest offset in px tried when aligning the two renders (default 2). */
  maxShift?: number;
  match?: MatchFn;
}

/** True when the pixel is (near) white or (near) transparent. */
function isBackground(d: Uint8Array, o: number, tol: number): boolean {
  if (d[o + 3] < tol) return true;
  return 255 - d[o] <= tol && 255 - d[o + 1] <= tol && 255 - d[o + 2] <= tol;
}

/** Bounding box of the non-background pixels, or null for a blank image. */
export function contentBBox(img: RgbaImage, whiteTolerance = 8): BBox | null {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!isBackground(img.data, (y * img.width + x) * 4, whiteTolerance)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Copies `bbox` of `img` into a white canvas of `width`×`height` at the top-left; transparency is flattened on white. */
export function cropAndPad(img: RgbaImage, bbox: BBox | null, width: number, height: number): RgbaImage {
  const out = createImage(width, height);
  if (!bbox) return out;
  for (let y = 0; y < bbox.height && y < height; y++) {
    for (let x = 0; x < bbox.width && x < width; x++) {
      const s = ((bbox.y + y) * img.width + bbox.x + x) * 4;
      const t = (y * width + x) * 4;
      const a = img.data[s + 3] / 255;
      out.data[t] = Math.round(255 + (img.data[s] - 255) * a);
      out.data[t + 1] = Math.round(255 + (img.data[s + 1] - 255) * a);
      out.data[t + 2] = Math.round(255 + (img.data[s + 2] - 255) * a);
      out.data[t + 3] = 255;
    }
  }
  return out;
}

/**
 * Built-in matcher: pixelmatch's YIQ color delta and threshold (maxDelta = 35215·t²),
 * without anti-aliasing detection. Used only when pixelmatch is not installed.
 */
export const builtinMatch: MatchFn = (img1, img2, output, width, height, options) => {
  const maxDelta = 35215 * options.threshold * options.threshold;
  let diff = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r1 = img1[o], g1 = img1[o + 1], b1 = img1[o + 2];
    const r2 = img2[o], g2 = img2[o + 1], b2 = img2[o + 2];
    const dy = 0.29889531 * (r1 - r2) + 0.58662247 * (g1 - g2) + 0.11448223 * (b1 - b2);
    const di = 0.59597799 * (r1 - r2) - 0.2741761 * (g1 - g2) - 0.32180189 * (b1 - b2);
    const dq = 0.21147017 * (r1 - r2) - 0.52261711 * (g1 - g2) + 0.31114694 * (b1 - b2);
    const delta = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
    const isDiff = delta > maxDelta;
    if (isDiff) diff++;
    if (output) {
      if (isDiff) {
        output[o] = 255;
        output[o + 1] = 0;
        output[o + 2] = 0;
      } else {
        const gray = 255 + ((0.299 * r1 + 0.587 * g1 + 0.114 * b1) - 255) * 0.1;
        output[o] = output[o + 1] = output[o + 2] = gray;
      }
      output[o + 3] = 255;
    }
  }
  return diff;
};

/** pixelmatch's YIQ colour distance between pixel `i` of `a` and pixel `j` of `b`. */
function yiqDelta(a: Uint8Array, i: number, b: Uint8Array, j: number): number {
  const r = a[i] - b[j];
  const g = a[i + 1] - b[j + 1];
  const bl = a[i + 2] - b[j + 2];
  const dy = 0.29889531 * r + 0.58662247 * g + 0.11448223 * bl;
  const di = 0.59597799 * r - 0.2741761 * g - 0.32180189 * bl;
  const dq = 0.21147017 * r - 0.52261711 * g + 0.31114694 * bl;
  return 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
}

/** True when some pixel of `img` within `radius` of (x, y) has (nearly) the colour of pixel `o` of `ref`. */
function hasNear(img: RgbaImage, ref: Uint8Array, o: number, x: number, y: number, radius: number, maxDelta: number): boolean {
  for (let j = Math.max(0, y - radius); j <= Math.min(img.height - 1, y + radius); j++) {
    for (let i = Math.max(0, x - radius); i <= Math.min(img.width - 1, x + radius); i++) {
      if (yiqDelta(ref, o, img.data, (j * img.width + i) * 4) <= maxDelta) return true;
    }
  }
  return false;
}

/** Copy of `img` moved by (dx, dy) on a white canvas of the same size. */
function shifted(img: RgbaImage, dx: number, dy: number): RgbaImage {
  if (dx === 0 && dy === 0) return img;
  const out = createImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= img.height) continue;
    for (let x = 0; x < img.width; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= img.width) continue;
      const s = (sy * img.width + sx) * 4;
      const t = (y * img.width + x) * 4;
      out.data[t] = img.data[s];
      out.data[t + 1] = img.data[s + 1];
      out.data[t + 2] = img.data[s + 2];
      out.data[t + 3] = img.data[s + 3];
    }
  }
  return out;
}

interface TolerantResult {
  diffPixels: number;
  contentPixels: number;
  /** 0 = same, 1 = differs only within the tolerance radius, 2 = differs. */
  marks: Uint8Array;
}

/**
 * Pixels that differ (YIQ delta above the threshold) and have no pixel of the same colour within
 * `radius` in the other image, in both directions. Sub-pixel placement and anti-aliasing move
 * edges by up to a pixel between two renderers; a missing, extra or recoloured part does not.
 */
function tolerantDiff(a: RgbaImage, b: RgbaImage, maxDelta: number, radius: number, tol: number): TolerantResult {
  const marks = new Uint8Array(a.width * a.height);
  let diffPixels = 0;
  let contentPixels = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const p = y * a.width + x;
      const o = p * 4;
      if (!isBackground(a.data, o, tol) || !isBackground(b.data, o, tol)) contentPixels++;
      if (yiqDelta(a.data, o, b.data, o) <= maxDelta) continue;
      if (radius > 0 && hasNear(b, a.data, o, x, y, radius, maxDelta) && hasNear(a, b.data, o, x, y, radius, maxDelta)) {
        marks[p] = 1;
      } else {
        marks[p] = 2;
        diffPixels++;
      }
    }
  }
  return { diffPixels, contentPixels, marks };
}

/** Compares the draw.io render with the app render (see file header for the metric). */
export function compareImages(drawio: RgbaImage, app: RgbaImage, options: CompareOptions = {}): CompareResult {
  const tol = options.whiteTolerance ?? 8;
  const threshold = options.threshold ?? PIXELMATCH_THRESHOLD;
  const radius = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxShift = options.maxShift ?? DEFAULT_MAX_SHIFT;
  const maxDelta = 35215 * threshold * threshold;
  const bd = contentBBox(drawio, tol);
  const ba = contentBBox(app, tol);
  const width = Math.max(bd?.width ?? 0, ba?.width ?? 0, 1) + 2 * maxShift;
  const height = Math.max(bd?.height ?? 0, ba?.height ?? 0, 1) + 2 * maxShift;
  const a = shifted(cropAndPad(drawio, bd, width, height), maxShift, maxShift);
  const b0 = shifted(cropAndPad(app, ba, width, height), maxShift, maxShift);

  // Best alignment within ±maxShift px (renderers round the drawing's origin differently)
  let best: TolerantResult | null = null;
  let bestB = b0;
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      const b = shifted(b0, dx, dy);
      const r = tolerantDiff(a, b, maxDelta, radius, tol);
      if (!best || r.diffPixels < best.diffPixels || (r.diffPixels === best.diffPixels && dx === 0 && dy === 0)) {
        best = r;
        bestB = b;
      }
    }
  }
  const result = best!;

  // Diff image: red = differs, yellow = differs only within the tolerance, grey = same
  const diff = createImage(width, height);
  for (let p = 0; p < result.marks.length; p++) {
    const o = p * 4;
    const m = result.marks[p];
    if (m === 2) {
      diff.data[o] = 255;
      diff.data[o + 1] = 0;
      diff.data[o + 2] = 0;
    } else if (m === 1) {
      diff.data[o] = 255;
      diff.data[o + 1] = 210;
      diff.data[o + 2] = 0;
    } else {
      const gray = 255 + ((0.299 * a.data[o] + 0.587 * a.data[o + 1] + 0.114 * a.data[o + 2]) - 255) * 0.1;
      diff.data[o] = diff.data[o + 1] = diff.data[o + 2] = gray;
    }
    diff.data[o + 3] = 255;
  }
  // Strict count (pixelmatch when installed) at the chosen alignment, for reference
  const match = options.match ?? builtinMatch;
  const strictDiffPixels = match(a.data, bestB.data, null, width, height, { threshold, includeAA: false });

  const blank = !bd && !ba ? 'both' : !bd ? 'drawio' : !ba ? 'app' : 'none';
  const diffRatio = blank === 'both' ? 0 : blank !== 'none' ? 1 : result.diffPixels / Math.max(result.contentPixels, 1);
  return {
    diffRatio,
    diffPixels: result.diffPixels,
    strictDiffPixels,
    contentPixels: result.contentPixels,
    width,
    height,
    drawioSize: { width: bd?.width ?? 0, height: bd?.height ?? 0 },
    appSize: { width: ba?.width ?? 0, height: ba?.height ?? 0 },
    sizeDelta: { width: (ba?.width ?? 0) - (bd?.width ?? 0), height: (ba?.height ?? 0) - (bd?.height ?? 0) },
    blank,
    diff,
  };
}

/** pass ≤ 2 %, warn ≤ 6 %, fail above; expected mismatches never fail. */
export function classify(diffRatio: number, expectedMismatch = false): ParityStatus {
  if (expectedMismatch) return 'expected';
  if (diffRatio <= THRESHOLDS.pass) return 'pass';
  if (diffRatio <= THRESHOLDS.warn) return 'warn';
  return 'fail';
}

export interface ImageDeps {
  decode(buf: Uint8Array): RgbaImage;
  encode(img: RgbaImage): Uint8Array;
  /** pixelmatch, or null when the package is not installed. */
  pixelmatch: MatchFn | null;
  /** Packages that could not be loaded. */
  missing: string[];
}

/** Imports an optional package without making TypeScript resolve it. */
async function optionalImport(name: string): Promise<Record<string, unknown> | null> {
  try {
    return (await import(/* @vite-ignore */ name)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface PngjsLike {
  sync: {
    read(buf: Uint8Array): { width: number; height: number; data: Uint8Array };
    write(png: { width: number; height: number; data: Uint8Array }): Uint8Array;
  };
}

/** Loads pngjs and pixelmatch when available, falling back to the built-in PNG codec. */
export async function loadImageDeps(): Promise<ImageDeps> {
  const missing: string[] = [];
  const pmMod = await optionalImport('pixelmatch');
  const pmCandidate = pmMod ? (pmMod.default ?? pmMod) : null;
  const pixelmatch = typeof pmCandidate === 'function' ? (pmCandidate as MatchFn) : null;
  if (!pixelmatch) missing.push('pixelmatch');
  const pngMod = await optionalImport('pngjs');
  const PNG = (pngMod?.PNG ?? (pngMod?.default as Record<string, unknown> | undefined)?.PNG) as PngjsLike | undefined;
  if (!PNG?.sync) missing.push('pngjs');
  return {
    decode: (buf) => {
      if (PNG?.sync) {
        const p = PNG.sync.read(Buffer.from(buf));
        return { width: p.width, height: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.byteLength) };
      }
      return decodePng(buf);
    },
    encode: (img) => (PNG?.sync ? PNG.sync.write({ width: img.width, height: img.height, data: Buffer.from(img.data) }) : encodePng(img)),
    pixelmatch,
    missing,
  };
}
