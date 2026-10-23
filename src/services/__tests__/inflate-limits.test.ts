import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { MAX_DECOMPRESSED_BYTES, compress, decompress } from '../../drawio-shapes/engine/codec';
import { InflateError, InflateLimitError as SyncInflateLimitError, inflateRaw, inflateZlib } from '../../drawio-shapes/engine/inflate';
import { InflateDataError, InflateLimitError, MAX_INFLATED_BYTES, deflateRawBytes, inflateRawBytes } from '../deflate-stream';
import { ProjectService } from '../project-service';
import { decodeShareHash, encodeShareData } from '../../share/share-link';
import { buildShareMxfile } from '../../share/share-mxfile';

/** A deflate bomb: `size` bytes of 'a' (URI-safe), a few KB compressed. */
function bomb(size: number): Buffer {
  return zlib.deflateRawSync(Buffer.alloc(size, 0x61), { level: 9 });
}

describe('deflate bombs are capped', () => {
  it('codec.decompress (stencils, library entries) stops at MAX_DECOMPRESSED_BYTES', () => {
    expect(MAX_DECOMPRESSED_BYTES).toBe(50 * 1024 * 1024);
    const data = bomb(MAX_DECOMPRESSED_BYTES + 1024).toString('base64');
    expect(data.length).toBeLessThan(200_000);
    expect(() => decompress(data)).toThrow(SyncInflateLimitError);
    expect(() => decompress(bomb(4096).toString('base64'), { maxBytes: 1000 })).toThrow(/exceeds 1000 bytes/);
    // within the limit: unchanged behaviour
    expect(decompress(compress('<mxGraphModel/>'))).toBe('<mxGraphModel/>');
    expect(decompress(bomb(1000).toString('base64'), { maxBytes: 1000 })).toBe('a'.repeat(1000));
  });

  it('the synchronous inflater honours maxOutput (raw and zlib), InflateLimitError is an InflateError', () => {
    const raw = new Uint8Array(bomb(10_000));
    expect(inflateRaw(raw).length).toBe(10_000);
    expect(() => inflateRaw(raw, 9_999)).toThrow(InflateError);
    expect(() => inflateZlib(new Uint8Array(zlib.deflateSync(Buffer.alloc(10_000))), 5000)).toThrow(SyncInflateLimitError);
  });

  it('the async inflater (pages, links) has a default cap and reports corrupt data', async () => {
    expect(MAX_INFLATED_BYTES).toBe(50 * 1024 * 1024);
    await expect(inflateRawBytes(new Uint8Array(bomb(10_000)), 9_999)).rejects.toBeInstanceOf(InflateLimitError);
    await expect(inflateRawBytes(new Uint8Array([0xff, 0xff, 0xff]))).rejects.toBeInstanceOf(InflateDataError);
    const round = await inflateRawBytes(await deflateRawBytes(new TextEncoder().encode('hello')));
    expect(new TextDecoder().decode(round)).toBe('hello');
  });

  it('compressed draw.io pages and share links use it with their own caps', async () => {
    expect(ProjectService.maxInflatedBytes).toBe(MAX_INFLATED_BYTES);
    const saved = ProjectService.maxInflatedBytes;
    ProjectService.maxInflatedBytes = 1000;
    try {
      await expect(ProjectService.decompressDiagram(bomb(2000).toString('base64'))).rejects.toThrow(/too large to open/);
    } finally {
      ProjectService.maxInflatedBytes = saved;
    }
    const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
    expect(await decodeShareHash(`#R${await encodeShareData(xml)}`)).toBe(xml);
  });
});

describe('one mxfile builder', () => {
  it('share links write unique page ids, keep step pages after their tab, skip non-pages', () => {
    const model = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel><!--meta-->';
    const xml = buildShareMxfile(
      [
        { name: 'A', modelXml: model, pageId: 'p1', sectionPages: ['<diagram id="p1" name="A step"><mxGraphModel/></diagram>'], extraPages: ['<notADiagram/>'] },
        { name: '', modelXml: model, pageId: 'p1', pageAttributes: { rdScenarios: 'x' } },
      ],
      '2026-01-01T00:00:00.000Z'
    );
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const pages = Array.from(doc.querySelectorAll('mxfile > diagram'));
    expect(pages.map((p) => p.getAttribute('name'))).toEqual(['A', 'A step', 'Page']);
    const ids = pages.map((p) => p.getAttribute('id'));
    expect(ids[0]).toBe('p1');
    expect(new Set(ids).size).toBe(3);
    expect(pages[2].getAttribute('rdScenarios')).toBe('x');
    expect(pages[0].innerHTML).toContain('<!--meta-->');
    expect(doc.documentElement.getAttribute('host')).toBe('railway-drawer');
    expect(doc.documentElement.getAttribute('modified')).toBe('2026-01-01T00:00:00.000Z');
  });
});
