/**
 * Decodes draw.io's js/stencils.min.js (pinned tag, see fetch-sources.ts) and writes the
 * stencil sets this app serves under public/stencils/.
 *
 * Usage: node scripts/drawio-palettes/decode-stencils-bundle.ts
 *
 * js/stencils.min.js stores each stencils/*.xml file as base64(deflate-raw(Xml2Js binary
 * node stream)). decodeStencilBundleEntry() below is a line-by-line TypeScript port of
 * the bundle's own decode() (Xml2Js.java counterpart), so the attribute values (numbers
 * formatted as String(n / 1000)) are exactly what draw.io feeds to mxStencil at runtime.
 * The bundle carries no text nodes, comments or formatting, so the XML is re-serialized
 * here with two-space indentation.
 *
 * Portions ported from jgraph/drawio v32.4.1 src/main/webapp/js/stencils.min.js
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under Apache-2.0.
 * Stencil data: see public/stencils/LICENSE.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, WEBAPP, readSource } from './fetch-sources.ts';

/** Stencil files (paths relative to draw.io's stencils/ dir) vendored into public/stencils/. */
export const VENDORED_STENCILS = ['basic.xml', 'flowchart.xml', 'arrows.xml', 'mscae/enterprise.xml'] as const;

export interface StencilNode {
  nodeName: string;
  attrs: Array<[string, string]>;
  children: StencilNode[];
}

const DRAW: Record<string, 1> = Object.assign(Object.create(null) as Record<string, 1>, {
  move: 1, line: 1, quad: 1, curve: 1, arc: 1, rect: 1, roundrect: 1, ellipse: 1, text: 1, image: 1, 'include-shape': 1,
});
const XS: Record<string, 1> = Object.assign(Object.create(null) as Record<string, 1>, { x: 1, x1: 1, x2: 1, x3: 1 });
const YS: Record<string, 1> = Object.assign(Object.create(null) as Record<string, 1>, { y: 1, y1: 1, y2: 1, y3: 1 });

/** Returns the map file name -> base64 payload of every `f['<file>'] = '<b64>'` in the bundle. */
export function parseStencilBundle(js: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /^f\['([^']+)'\]\s*=\s*'([A-Za-z0-9+/=]*)'\s*;?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) out.set(m[1], m[2]);
  return out;
}

/** Port of decode(t) from js/stencils.min.js. Returns the document element. */
export function decodeStencilBundleEntry(b64: string): StencilNode {
  const d = new Uint8Array(zlib.inflateRawSync(Buffer.from(b64, 'base64'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }));
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const s: Uint8Array[] = [];
  for (let i = 0, o = 20; i < 5; i++) {
    const n = v.getUint32(4 * i);
    s.push(d.subarray(o, o + n));
    o += n;
  }
  const ops = s[0];
  const strs = new TextDecoder().decode(s[4]).split('\0');
  const p = [0, 0, 0, 0];
  let si = 0;
  const names: string[] = [];
  const attrNames: string[] = [];
  const root: StencilNode = { nodeName: '#root', attrs: [], children: [] };
  const stack: StencilNode[] = [root];
  let parent = root;
  let px = 0;
  let py = 0;
  let pn = new Map<string, number>();
  const cache = new Map<number, string>();

  const read = (k: number): number => {
    const bytes = s[k];
    let n = 0;
    let mul = 1;
    let c: number;
    do {
      c = bytes[p[k]++];
      n += (c & 127) * mul;
      mul *= 128;
    } while (c & 128);
    return n % 2 === 1 ? -(n + 1) / 2 : n / 2;
  };
  const format = (n: number): string => {
    let value = cache.get(n);
    if (value === undefined) {
      value = String(n / 1000);
      cache.set(n, value);
    }
    return value;
  };

  while (p[0] < ops.length) {
    const op = ops[p[0]++];
    if (op === 255) {
      stack.pop();
      parent = stack[stack.length - 1];
      continue;
    }
    if (op >> 1 === names.length) names.push(strs[si++]);
    const name = names[op >> 1];
    const node: StencilNode = { nodeName: name, attrs: [], children: [] };
    const count = ops[p[0]++];
    const coords = DRAW[name] === 1;
    parent.children.push(node);
    if (name === 'shape') {
      px = 0;
      py = 0;
      pn = new Map();
    }
    for (let i = 0; i < count; i++) {
      const id = ops[p[0]++];
      if (id === attrNames.length) attrNames.push(strs[si++]);
      const attr = attrNames[id];
      let value: string;
      if (ops[p[0]++] === 0) {
        value = strs[si++];
      } else if (coords && XS[attr] === 1) {
        px += read(1);
        value = format(px);
      } else if (coords && YS[attr] === 1) {
        py += read(2);
        value = format(py);
      } else {
        const key = name + ' ' + attr;
        const next = (pn.get(key) || 0) + read(3);
        pn.set(key, next);
        value = format(next);
      }
      // Later duplicates overwrite earlier ones, as node.attrs[attr] = ... does upstream
      const idx = node.attrs.findIndex(([k]) => k === attr);
      if (idx >= 0) node.attrs[idx] = [attr, value];
      else node.attrs.push([attr, value]);
    }
    if ((op & 1) === 0) {
      stack.push(node);
      parent = node;
    }
  }
  if (root.children.length === 0) throw new Error('empty stencil bundle entry');
  return root.children[0];
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
}

export function stencilNodeToXml(n: StencilNode, indent = ''): string {
  const attrs = n.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
  if (n.children.length === 0) return `${indent}<${n.nodeName}${attrs}/>\n`;
  let out = `${indent}<${n.nodeName}${attrs}>\n`;
  for (const c of n.children) out += stencilNodeToXml(c, indent + '  ');
  return out + `${indent}</${n.nodeName}>\n`;
}

export function decodeVendoredStencils(): Map<string, string> {
  const bundle = parseStencilBundle(readSource(WEBAPP + 'js/stencils.min.js'));
  const out = new Map<string, string>();
  for (const file of VENDORED_STENCILS) {
    const b64 = bundle.get(file);
    if (b64 == null) throw new Error(`stencils.min.js has no entry for ${file}`);
    const root = decodeStencilBundleEntry(b64);
    if (root.nodeName !== 'shapes') throw new Error(`${file}: unexpected root <${root.nodeName}>`);
    out.set(file, stencilNodeToXml(root));
  }
  return out;
}

/** Every stencil file of the bundle (file name relative to stencils/ -> XML), sorted by name. */
export function decodeAllStencils(): Map<string, string> {
  const bundle = parseStencilBundle(readSource(WEBAPP + 'js/stencils.min.js'));
  const out = new Map<string, string>();
  for (const file of [...bundle.keys()].sort()) {
    const root = decodeStencilBundleEntry(bundle.get(file) as string);
    if (root.nodeName !== 'shapes') throw new Error(`${file}: unexpected root <${root.nodeName}>`);
    out.set(file, stencilNodeToXml(root));
  }
  return out;
}

const isMain = process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // every set of the bundle: palettes, and drawings that use any draw.io stencil, find their XML
  const all = decodeAllStencils();
  for (const file of VENDORED_STENCILS) if (!all.has(file)) throw new Error(`stencils.min.js has no entry for ${file}`);
  let total = 0;
  for (const [file, xml] of all) {
    const dest = path.join(REPO_ROOT, 'public', 'stencils', file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, xml);
    const count = (xml.match(/^ {2}<shape /gm) || []).length;
    total += count;
    if (process.argv.includes('--verbose')) console.log(`wrote public/stencils/${file} (${count} shapes, ${xml.length} bytes)`);
  }
  console.log(`wrote ${all.size} stencil sets (${total} shapes) to public/stencils/`);
}
