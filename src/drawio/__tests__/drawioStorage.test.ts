import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAWIO_AUTOSAVE_KEY,
  loadAutosave,
  looksLikeDrawioXml,
  sanitizeFilename,
  saveAutosave,
  svgDataUriToBlob,
  titleFromFilename,
} from '../drawioStorage';

function fakeStorage(overrides: Partial<Storage>): Storage {
  return {
    length: 0,
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.removeItem(DRAWIO_AUTOSAVE_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('autosave', () => {
  it('round-trips xml and title', () => {
    expect(saveAutosave({ xml: '<mxfile/>', title: 'Station A' })).toEqual({ ok: true });
    const doc = loadAutosave();
    expect(doc).toMatchObject({ xml: '<mxfile/>', title: 'Station A' });
    expect(doc?.savedAt).toBeTruthy();
  });

  it('returns null when nothing or garbage is stored', () => {
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(DRAWIO_AUTOSAVE_KEY, '{garbage');
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(DRAWIO_AUTOSAVE_KEY, JSON.stringify({ title: 'no xml' }));
    expect(loadAutosave()).toBeNull();
  });

  it('reports quota errors without throwing', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      })
    );
    expect(saveAutosave({ xml: '<mxfile/>', title: 't' })).toEqual({ ok: false, reason: 'quota' });
  });

  it('reports other storage errors as unavailable', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
      })
    );
    expect(saveAutosave({ xml: '<mxfile/>', title: 't' })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns null when reading storage throws', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        getItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
      })
    );
    expect(loadAutosave()).toBeNull();
  });
});

describe('looksLikeDrawioXml', () => {
  it('accepts mxfile, mxGraphModel and compressed diagrams', () => {
    expect(looksLikeDrawioXml('<mxfile><diagram id="a"><mxGraphModel/></diagram></mxfile>')).toBe(true);
    expect(looksLikeDrawioXml('<mxGraphModel><root/></mxGraphModel>')).toBe(true);
    expect(looksLikeDrawioXml('\uFEFF<?xml version="1.0"?>\n<mxfile host="x"><diagram id="p">7VhNb5tAEP01HFuxi/lYTMR+pE=</diagram></mxfile>')).toBe(true);
  });

  it('rejects SVG, random text and malformed XML', () => {
    expect(looksLikeDrawioXml('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(false);
    expect(looksLikeDrawioXml('hello world')).toBe(false);
    expect(looksLikeDrawioXml('<mxfile><diagram></mxfile>')).toBe(false);
  });
});

describe('filenames', () => {
  it('sanitizes forbidden characters and empty names', () => {
    expect(sanitizeFilename('Station: A/B?')).toBe('Station_ A_B_');
    expect(sanitizeFilename('   ')).toBe('diagram');
    expect(sanitizeFilename('..hidden')).toBe('hidden');
  });

  it('derives titles from file names', () => {
    expect(titleFromFilename('Station A.drawio')).toBe('Station A');
    expect(titleFromFilename('plan.xml')).toBe('plan');
    expect(titleFromFilename('.drawio')).toBe('Untitled diagram');
  });
});

/** jsdom's Blob has no text(); read it through FileReader. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('svgDataUriToBlob', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

  it('decodes a base64 SVG data URI', async () => {
    const blob = svgDataUriToBlob(`data:image/svg+xml;base64,${btoa(svg)}`);
    expect(blob.type).toBe('image/svg+xml');
    expect(await readBlob(blob)).toBe(svg);
  });

  it('decodes a percent-encoded SVG data URI with a charset', async () => {
    const blob = svgDataUriToBlob(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    expect(await readBlob(blob)).toBe(svg);
  });

  it('throws for javascript: URLs and other media types', () => {
    expect(() => svgDataUriToBlob('javascript:alert(1)')).toThrow(/not an SVG data URI/);
    expect(() => svgDataUriToBlob('data:text/html,<script>alert(1)</script>')).toThrow(/not an SVG data URI/);
    expect(() => svgDataUriToBlob('data:image/svg+xmlfoo,<svg/>')).toThrow(/not an SVG data URI/);
  });
});
