import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  MAX_SHARED_XML_BYTES,
  ShareLinkError,
  buildAppShareLink,
  buildDrawioShareLink,
  decodeShareHash,
  encodeShareData,
  fromBase64Url,
  isShareHash,
  stripShareHash,
} from '../share-link';
import { buildShareMxfile, splitSharedFile } from '../share-mxfile';

const MODEL = (label: string) =>
  `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  `<mxCell id="2" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">` +
  `<mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;

const POLISH = 'Zażółć gęślą jaźń — Łódź, Śląsk & <ERTMS> "L2" 🚆';

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** draw.io's Graph.compress with pako.deflateRaw (zlib's raw deflate is the same format). */
function drawioGraphCompress(xml: string): string {
  return deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
}

/** draw.io's reader (App.js:6669 + Graph.decompress). */
function drawioReadHash(hash: string): string {
  let data = decodeURIComponent(hash.substring(2));
  if (data.charAt(0) !== '<') {
    data = decodeURIComponent(inflateRawSync(Buffer.from(data, 'base64')).toString('latin1'));
  }
  return data;
}

describe('share links (#R)', () => {
  it('round-trips a diagram with Polish characters', async () => {
    const xml = `<mxfile><diagram id="a" name="Stacja Łódź">${MODEL(escapeAttr(POLISH))}</diagram></mxfile>`;
    const link = await buildAppShareLink(xml, 'https://railwaydrawer.example/');
    expect(link.startsWith('https://railwaydrawer.example/#R')).toBe(true);
    const hash = link.slice(link.indexOf('#'));
    // base64url: no characters that need escaping in a URL
    expect(hash.slice(2)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShareHash(hash)).toBe(xml);
  });

  it('round-trips every tab of a multi-tab share file', async () => {
    const xml = buildShareMxfile([
      { name: 'Tab ą', modelXml: MODEL('one') },
      { name: 'Tab 2', modelXml: MODEL('two'), extraPages: [`<diagram id="p3" name="Kept page">${MODEL('three')}</diagram>`] },
    ]);
    const decoded = await decodeShareHash(`#R${await encodeShareData(xml)}`);
    const pages = splitSharedFile(decoded);
    expect(pages.map((p) => p.name)).toEqual(['Tab ą', 'Tab 2', 'Kept page']);
    expect(pages[1].fileXml).toContain('value="two"');
    expect(pages[2].fileXml).toContain('value="three"');
    // each split file is a single-page mxfile
    for (const page of pages) expect(page.fileXml.match(/<diagram /g)).toHaveLength(1);
  });

  it('writes unique page ids when tabs share one', () => {
    const xml = buildShareMxfile([
      { name: 'A', modelXml: MODEL('a'), pageId: 'same' },
      { name: 'B', modelXml: MODEL('b'), pageId: 'same', extraPages: [`<diagram id="same" name="C">${MODEL('c')}</diagram>`] },
    ]);
    const ids = Array.from(new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('diagram')).map((d) =>
      d.getAttribute('id')
    );
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe('same');
  });

  it('keeps multi-line labels (escaped newlines) through the round trip', async () => {
    const xml = buildShareMxfile([{ name: 'T', modelXml: MODEL('line 1&#10;line 2') }]);
    const page = splitSharedFile(await decodeShareHash(`#R${await encodeShareData(xml)}`))[0];
    const cell = new DOMParser().parseFromString(page.fileXml, 'text/xml').querySelector('mxCell[id="2"]');
    expect(cell?.getAttribute('value')).toBe('line 1\nline 2');
  });

  it('opens draw.io #R links (draw.io algorithm, standard base64, URI-encoded)', async () => {
    const xml = `<mxfile host="app.diagrams.net"><diagram id="x" name="Strona-1">${MODEL(escapeAttr(POLISH))}</diagram></mxfile>`;
    const drawioHash = `#R${encodeURIComponent(drawioGraphCompress(xml))}`;
    expect(drawioHash).toMatch(/%2B|%2F|%3D/); // standard base64, escaped
    expect(await decodeShareHash(drawioHash)).toBe(xml);
  });

  it('opens draw.io raw XML #R links', async () => {
    const xml = `<mxfile><diagram id="x" name="P">${MODEL('raw')}</diagram></mxfile>`;
    expect(await decodeShareHash(`#R${encodeURIComponent(xml)}`)).toBe(xml);
  });

  it('builds app.diagrams.net links that draw.io decodes', async () => {
    const xml = `<mxfile><diagram id="x" name="Ł">${MODEL(escapeAttr(POLISH))}</diagram></mxfile>`;
    const link = await buildDrawioShareLink(xml);
    expect(link.startsWith('https://app.diagrams.net/#R')).toBe(true);
    expect(drawioReadHash(link.slice(link.indexOf('#')))).toBe(xml);
  });

  it('rejects decoded data over the size cap', async () => {
    const big = `<mxfile><diagram id="x" name="big">${MODEL('x'.repeat(4000))}</diagram></mxfile>`;
    const hash = `#R${await encodeShareData(big)}`;
    await expect(decodeShareHash(hash, { maxBytes: 1000 })).rejects.toThrow(/too large/);
    // the default cap is 5 MB
    expect(MAX_SHARED_XML_BYTES).toBe(5 * 1024 * 1024);
  });

  it('stops inflating a deflate bomb at the cap', async () => {
    const bomb = deflateRawSync(Buffer.from(encodeURIComponent('<a>' + 'A'.repeat(2_000_000) + '</a>'), 'latin1'));
    const hash = `#R${encodeURIComponent(bomb.toString('base64'))}`;
    expect(hash.length).toBeLessThan(10_000);
    await expect(decodeShareHash(hash, { maxBytes: 100_000 })).rejects.toThrow(/too large/);
  });

  it('reports malformed links', async () => {
    await expect(decodeShareHash('#R')).rejects.toBeInstanceOf(ShareLinkError);
    await expect(decodeShareHash('#R%E0%A4%A')).rejects.toThrow(/invalid URL encoding/);
    await expect(decodeShareHash('#R!!!not-base64!!!')).rejects.toThrow(/base64/);
    await expect(decodeShareHash('#RAAAA')).rejects.toThrow(/corrupt|incomplete|diagram/);
    // a truncated link (cut off by a chat app)
    const good = await encodeShareData(`<mxfile><diagram id="x" name="p">${MODEL('cut')}</diagram></mxfile>`);
    await expect(decodeShareHash(`#R${good.slice(0, Math.floor(good.length / 2))}`)).rejects.toBeInstanceOf(ShareLinkError);
    // valid compression of something that is not XML
    const text = deflateRawSync(Buffer.from(encodeURIComponent('hello world'), 'latin1')).toString('base64');
    await expect(decodeShareHash(`#R${encodeURIComponent(text)}`)).rejects.toThrow(/does not contain a diagram/);
  });

  it('splitSharedFile rejects what is not a draw.io file', () => {
    expect(() => splitSharedFile('<html><script>alert(1)</script></html>')).toThrow(/draw.io diagram/);
    expect(() => splitSharedFile('<mxfile>')).toThrow(/not valid XML/);
    expect(() => splitSharedFile('<mxfile></mxfile>')).toThrow(/no pages/);
    expect(splitSharedFile(MODEL('bare'))).toHaveLength(1);
  });

  it('base64url helpers and hash detection', () => {
    expect(fromBase64Url('-_8')).toBe('+/8=');
    expect(() => fromBase64Url('abcde')).toThrow();
    expect(isShareHash('#R')).toBe(false);
    expect(isShareHash('#Rabc')).toBe(true);
    expect(isShareHash('#G123')).toBe(false);
  });

  it('stripShareHash removes the hash but keeps path and query', () => {
    window.history.replaceState(null, '', '/railway-drawer/?x=1#Rabc');
    stripShareHash(window);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/railway-drawer/?x=1');
  });
});
