/**
 * @file inflate.ts
 * @brief Synchronous, lenient raw DEFLATE (RFC 1951) decoder plus a store-only encoder.
 *
 * Ported from tiny-inflate 1.0.3 (https://github.com/foliojs/tiny-inflate), which is itself a
 * port of tinf by Joergen Ibsen. Changes from the original: TypeScript, a growable output
 * buffer (the decompressed size is not known up front), and lenient end-of-input handling:
 * a stream that ends before its final block returns the bytes decoded so far instead of
 * failing (draw.io's Visio import writes such streams into `shape=stencil(...)`).
 *
 * It is synchronous on purpose: CellRenderer.createShape, which decodes `stencil(...)`
 * styles, is synchronous. No npm dependency is needed.
 *
 * ---------------------------------------------------------------------------------------
 * tiny-inflate - MIT License
 *
 * Copyright (c) 2015-present Devon Govett
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * tinf - tiny inflate library (inflate, gzip, zlib) - zlib License
 * Copyright (c) 2003-2019 Joergen Ibsen
 * This software is provided 'as-is', without any express or implied warranty. In no event
 * will the authors be held liable for any damages arising from the use of this software.
 * Permission is granted to anyone to use this software for any purpose, including commercial
 * applications, and to alter it and redistribute it freely, subject to the following
 * restrictions: 1. The origin of this software must not be misrepresented; you must not
 * claim that you wrote the original software. If you use this software in a product, an
 * acknowledgment in the product documentation would be appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be misrepresented
 * as being the original software. 3. This notice may not be removed or altered from any
 * source distribution.
 * ---------------------------------------------------------------------------------------
 */

/** Thrown for malformed (not merely truncated) DEFLATE data. */
export class InflateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InflateError';
  }
}

/** Internal signal: the input ran out. Never escapes inflateRaw. */
class EndOfInput extends Error {}

class Tree {
  /** Number of codes of each length (index 0..15). */
  readonly table = new Uint16Array(16);
  /** Code -> symbol translation table. */
  readonly trans = new Uint16Array(288);
}

class Data {
  index = 0;
  tag = 0;
  bitcount = 0;
  dest: Uint8Array;
  destLen = 0;
  readonly ltree = new Tree();
  readonly dtree = new Tree();

  constructor(readonly source: Uint8Array) {
    this.dest = new Uint8Array(Math.max(1024, source.length * 4));
  }

  ensure(extra: number): void {
    const need = this.destLen + extra;
    if (need <= this.dest.length) return;
    let size = this.dest.length * 2;
    while (size < need) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.dest.subarray(0, this.destLen));
    this.dest = grown;
  }

  push(byte: number): void {
    if (this.destLen >= this.dest.length) this.ensure(1);
    this.dest[this.destLen++] = byte;
  }
}

// --- static tables --------------------------------------------------------------------------

const sltree = new Tree();
const sdtree = new Tree();
const lengthBits = new Uint8Array(30);
const lengthBase = new Uint16Array(30);
const distBits = new Uint8Array(30);
const distBase = new Uint16Array(30);
const clcidx = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
const codeTree = new Tree();
const lengths = new Uint8Array(288 + 32);

function buildBitsBase(bits: Uint8Array, base: Uint16Array, delta: number, first: number): void {
  for (let i = 0; i < delta; ++i) bits[i] = 0;
  for (let i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;
  for (let sum = first, i = 0; i < 30; ++i) {
    base[i] = sum;
    sum += 1 << bits[i];
  }
}

function buildFixedTrees(lt: Tree, dt: Tree): void {
  for (let i = 0; i < 7; ++i) lt.table[i] = 0;
  lt.table[7] = 24;
  lt.table[8] = 152;
  lt.table[9] = 112;
  for (let i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
  for (let i = 0; i < 144; ++i) lt.trans[24 + i] = i;
  for (let i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
  for (let i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;

  for (let i = 0; i < 5; ++i) dt.table[i] = 0;
  dt.table[5] = 32;
  for (let i = 0; i < 32; ++i) dt.trans[i] = i;
}

const offs = new Uint16Array(16);

function buildTree(t: Tree, lens: Uint8Array, off: number, num: number): void {
  t.table.fill(0);
  for (let i = 0; i < num; ++i) t.table[lens[off + i]]++;
  t.table[0] = 0;
  for (let sum = 0, i = 0; i < 16; ++i) {
    offs[i] = sum;
    sum += t.table[i];
  }
  for (let i = 0; i < num; ++i) {
    if (lens[off + i]) t.trans[offs[lens[off + i]]++] = i;
  }
}

buildFixedTrees(sltree, sdtree);
buildBitsBase(lengthBits, lengthBase, 4, 3);
buildBitsBase(distBits, distBase, 2, 1);
lengthBits[28] = 0;
lengthBase[28] = 258;

// --- bit reading ----------------------------------------------------------------------------

function getBit(d: Data): number {
  if (!d.bitcount--) {
    if (d.index >= d.source.length) throw new EndOfInput();
    d.tag = d.source[d.index++];
    d.bitcount = 7;
  }
  const bit = d.tag & 1;
  d.tag >>>= 1;
  return bit;
}

function readBits(d: Data, num: number, base: number): number {
  if (!num) return base;
  let val = 0;
  for (let i = 0; i < num; ++i) val |= getBit(d) << i;
  return val + base;
}

function decodeSymbol(d: Data, t: Tree): number {
  let sum = 0;
  let cur = 0;
  let len = 0;
  do {
    cur = 2 * cur + getBit(d);
    if (++len > 15) throw new InflateError('invalid Huffman code');
    sum += t.table[len];
    cur -= t.table[len];
  } while (cur >= 0);
  return t.trans[sum + cur];
}

function decodeTrees(d: Data, lt: Tree, dt: Tree): void {
  const hlit = readBits(d, 5, 257);
  const hdist = readBits(d, 5, 1);
  const hclen = readBits(d, 4, 4);

  for (let i = 0; i < 19; ++i) lengths[i] = 0;
  for (let i = 0; i < hclen; ++i) lengths[clcidx[i]] = readBits(d, 3, 0);
  buildTree(codeTree, lengths, 0, 19);

  for (let num = 0; num < hlit + hdist; ) {
    const sym = decodeSymbol(d, codeTree);
    let length: number;
    let value = 0;
    switch (sym) {
      case 16:
        if (num === 0) throw new InflateError('repeat with no previous length');
        value = lengths[num - 1];
        length = readBits(d, 2, 3);
        break;
      case 17:
        length = readBits(d, 3, 3);
        break;
      case 18:
        length = readBits(d, 7, 11);
        break;
      default:
        lengths[num++] = sym;
        continue;
    }
    if (num + length > hlit + hdist) throw new InflateError('too many code lengths');
    for (; length; --length) lengths[num++] = value;
  }

  buildTree(lt, lengths, 0, hlit);
  buildTree(dt, lengths, hlit, hdist);
}

function inflateBlockData(d: Data, lt: Tree, dt: Tree): void {
  for (;;) {
    let sym = decodeSymbol(d, lt);
    if (sym === 256) return;
    if (sym < 256) {
      d.push(sym);
      continue;
    }
    sym -= 257;
    if (sym >= 29) throw new InflateError('invalid length symbol');
    const length = readBits(d, lengthBits[sym], lengthBase[sym]);
    const dist = decodeSymbol(d, dt);
    if (dist >= 30) throw new InflateError('invalid distance symbol');
    const from = d.destLen - readBits(d, distBits[dist], distBase[dist]);
    if (from < 0) throw new InflateError('distance too far back');
    d.ensure(length);
    for (let i = from; i < from + length; ++i) d.dest[d.destLen++] = d.dest[i];
  }
}

function inflateUncompressedBlock(d: Data): void {
  // Discard the remaining bits of the current byte
  d.bitcount = 0;
  d.tag = 0;
  if (d.index + 4 > d.source.length) throw new EndOfInput();
  const s = d.source;
  const length = s[d.index] | (s[d.index + 1] << 8);
  const invlength = s[d.index + 2] | (s[d.index + 3] << 8);
  if (length !== (~invlength & 0xffff)) throw new InflateError('stored block length mismatch');
  d.index += 4;
  const available = Math.min(length, s.length - d.index);
  d.ensure(available);
  d.dest.set(s.subarray(d.index, d.index + available), d.destLen);
  d.destLen += available;
  d.index += available;
  if (available < length) throw new EndOfInput();
}

/**
 * Inflates a raw DEFLATE stream (no zlib/gzip header).
 *
 * Lenient: when the input ends before a block with BFINAL set, the bytes decoded so far are
 * returned. Malformed data (invalid codes, bad stored-block lengths) throws InflateError.
 */
export function inflateRaw(source: Uint8Array): Uint8Array {
  const d = new Data(source);
  try {
    let bfinal: number;
    do {
      bfinal = getBit(d);
      const btype = readBits(d, 2, 0);
      switch (btype) {
        case 0:
          inflateUncompressedBlock(d);
          break;
        case 1:
          inflateBlockData(d, sltree, sdtree);
          break;
        case 2:
          decodeTrees(d, d.ltree, d.dtree);
          inflateBlockData(d, d.ltree, d.dtree);
          break;
        default:
          throw new InflateError('invalid block type');
      }
    } while (!bfinal);
  } catch (err) {
    if (!(err instanceof EndOfInput)) throw err;
  }
  return d.dest.slice(0, d.destLen);
}

/**
 * Inflates a zlib-wrapped stream (RFC 1950): skips the 2-byte header (and a preset
 * dictionary id) and ignores the Adler-32 trailer. Equivalent of pako.inflate.
 */
export function inflateZlib(source: Uint8Array): Uint8Array {
  if (source.length < 2) return new Uint8Array(0);
  const cmf = source[0];
  const flg = source[1];
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) {
    throw new InflateError('invalid zlib header');
  }
  const start = flg & 0x20 ? 6 : 2;
  return inflateRaw(source.subarray(start));
}

const MAX_STORED = 0xffff;

/**
 * Encodes bytes as a raw DEFLATE stream of stored (uncompressed) blocks. Any inflater,
 * including draw.io's pako.inflateRaw, reads it. Used for compress() round trips.
 */
export function deflateRawStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / MAX_STORED));
  const out = new Uint8Array(data.length + blocks * 5);
  let o = 0;
  for (let b = 0; b < blocks; b++) {
    const start = b * MAX_STORED;
    const len = Math.min(MAX_STORED, data.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0; // BFINAL, BTYPE=00
    out[o++] = len & 0xff;
    out[o++] = (len >>> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >>> 8) & 0xff;
    out.set(data.subarray(start, start + len), o);
    o += len;
  }
  return out;
}
