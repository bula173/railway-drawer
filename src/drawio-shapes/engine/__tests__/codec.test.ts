import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { compress, decompress, zapGremlins } from '../codec';
import { InflateError, deflateRawStored, inflateRaw, inflateZlib } from '../inflate';

const ERTMS_PATH = path.resolve(__dirname, '../../../../public/libraries/ertms.xml');

const text = (b: Uint8Array): string => Buffer.from(b).toString('latin1');

/** draw.io-style compression with real deflate (pako.deflateRaw equivalent). */
const drawioCompress = (xml: string): string =>
  zlib.deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');

describe('inflateRaw', () => {
  it('decodes fixed-Huffman and dynamic-Huffman streams', () => {
    const short = 'hello hello hello';
    expect(text(inflateRaw(zlib.deflateRawSync(Buffer.from(short))))).toBe(short);
    const long = Array.from({ length: 4000 }, (_, i) => `<path x="${i % 97}" y="${(i * 7) % 13}"/>`).join('');
    expect(text(inflateRaw(zlib.deflateRawSync(Buffer.from(long), { level: 9 })))).toBe(long);
  });

  it('returns everything when the stream has no final block', () => {
    const src = 'stream without a final block '.repeat(50);
    const deflated = zlib.deflateRawSync(Buffer.from(src), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    expect(text(inflateRaw(deflated))).toBe(src);
  });

  it('returns the decoded prefix of a truncated stream', () => {
    const src = Array.from({ length: 2000 }, (_, i) => String.fromCharCode(65 + ((i * 31) % 26))).join('');
    const deflated = zlib.deflateRawSync(Buffer.from(src));
    const partial = text(inflateRaw(deflated.subarray(0, Math.floor(deflated.length / 2))));
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(src.length);
    expect(src.startsWith(partial)).toBe(true);
  });

  it('round-trips stored blocks, including multi-block and empty input', () => {
    const big = new Uint8Array(150_000).map((_, i) => (i * 13) % 256);
    expect(Buffer.from(inflateRaw(deflateRawStored(big))).equals(Buffer.from(big))).toBe(true);
    expect(zlib.inflateRawSync(deflateRawStored(big)).equals(Buffer.from(big))).toBe(true);
    expect(inflateRaw(deflateRawStored(new Uint8Array(0))).length).toBe(0);
  });

  it('inflates zlib-wrapped data and rejects malformed data', () => {
    expect(text(inflateZlib(zlib.deflateSync(Buffer.from('zlib wrapped'))))).toBe('zlib wrapped');
    expect(() => inflateRaw(new Uint8Array([0x07, 0xff]))).toThrow(InflateError);
  });
});

describe('codec', () => {
  it('round-trips compress/decompress (unicode, special chars)', () => {
    const xml = '<shape name="Zażółć" w="10"><foreground><path><move x="0" y="0"/></path></foreground></shape>';
    expect(decompress(compress(xml))).toBe(xml);
    expect(compress('')).toBe('');
    expect(decompress('')).toBe('');
  });

  it('produces output that zlib (pako equivalent) reads', () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
    const raw = zlib.inflateRawSync(Buffer.from(compress(xml), 'base64')).toString('latin1');
    expect(decodeURIComponent(raw)).toBe(xml);
  });

  it('decodes draw.io (real deflate) payloads and strips gremlins', () => {
    const xml = '<a b="1">x\u0001y</a>';
    expect(decompress(drawioCompress(xml))).toBe('<a b="1">xy</a>');
    expect(decompress(drawioCompress(xml), { checked: true })).toBe(xml);
  });

  it('returns the raw string when URI decoding fails', () => {
    const raw = '100% <a/>';
    const b64 = zlib.deflateRawSync(Buffer.from(raw, 'latin1')).toString('base64');
    expect(decompress(b64)).toBe(raw);
  });

  it('zapGremlins keeps TAB/LF/CR and drops other control chars', () => {
    expect(zapGremlins('a\tb\nc\rd\u0000e\u001ff￿')).toBe('a\tb\nc\rdef');
    expect(zapGremlins('clean')).toBe('clean');
  });

  it('decodes every stencil(...) in public/libraries/ertms.xml', () => {
    const lib = fs.readFileSync(ERTMS_PATH, 'utf8');
    const all = [...lib.matchAll(/shape=stencil\(([^)]*)\)/g)].map((m) => m[1]);
    const unique = [...new Set(all)];
    expect(all.length).toBeGreaterThan(0);
    expect(unique.length).toBe(14);
    const failures: string[] = [];
    for (const b64 of unique) {
      try {
        const xml = decompress(b64);
        const expected = decodeURIComponent(
          zlib
            .inflateRawSync(Buffer.from(b64, 'base64'), { finishFlush: zlib.constants.Z_SYNC_FLUSH })
            .toString('latin1')
        );
        expect(xml).toBe(zapGremlins(expected));
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        expect(doc.getElementsByTagName('parsererror').length).toBe(0);
        expect(doc.documentElement.nodeName).toBe('shape');
      } catch (err) {
        failures.push(`${b64.slice(0, 20)}: ${String(err)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('decodes ertms stencils even when their deflate stream is truncated after the XML', () => {
    const lib = fs.readFileSync(ERTMS_PATH, 'utf8');
    const b64 = lib.match(/shape=stencil\(([^)]*)\)/)![1];
    const full = decompress(b64);
    // Re-encode without a final block (what Visio-import payloads look like)
    const noFinal = zlib
      .deflateRawSync(Buffer.from(encodeURIComponent(full), 'latin1'), { finishFlush: zlib.constants.Z_SYNC_FLUSH })
      .toString('base64');
    expect(decompress(noFinal)).toBe(full);
  });
});
