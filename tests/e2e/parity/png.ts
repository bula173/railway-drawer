/**
 * @file png.ts
 * @brief Minimal PNG codec for the draw.io parity harness (Node only).
 *
 * Decodes 8-bit, non-interlaced PNGs of color type 0/2/3/4/6 (what Chrome's
 * canvas.toDataURL and Playwright screenshots produce) and encodes RGBA PNGs.
 * When the optional `pngjs` devDependency is installed, compare.ts prefers it;
 * this codec keeps the harness and its unit tests usable without it.
 */

import { crc32, deflateSync, inflateSync } from 'node:zlib';

/** An RGBA image, 4 bytes per pixel, row-major. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function createImage(width: number, height: number, fill: [number, number, number, number] = [255, 255, 255, 255]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { width, height, data };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes a PNG buffer to RGBA. Throws on unsupported formats. */
export function decodePng(buffer: Uint8Array): RgbaImage {
  const buf = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
  }
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || interlace !== 0 || channels === undefined) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`);
  }
  if (colorType === 3 && !palette) throw new Error('PNG palette missing');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = rows.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      out[x] = v & 0xff;
    }
    prev = out;
  }
  const img = createImage(width, height, [0, 0, 0, 255]);
  const d = img.data;
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    const o = i * 4;
    if (colorType === 6) {
      d[o] = rows[p];
      d[o + 1] = rows[p + 1];
      d[o + 2] = rows[p + 2];
      d[o + 3] = rows[p + 3];
    } else if (colorType === 2) {
      d[o] = rows[p];
      d[o + 1] = rows[p + 1];
      d[o + 2] = rows[p + 2];
    } else if (colorType === 0) {
      d[o] = d[o + 1] = d[o + 2] = rows[p];
    } else if (colorType === 4) {
      d[o] = d[o + 1] = d[o + 2] = rows[p];
      d[o + 3] = rows[p + 1];
    } else {
      const idx = rows[p];
      d[o] = palette![idx * 3];
      d[o + 1] = palette![idx * 3 + 1];
      d[o + 2] = palette![idx * 3 + 2];
      d[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return img;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

/** Encodes an RGBA image as PNG (filter 0, zlib default level). */
export function encodePng(img: RgbaImage): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function dataUriToBuffer(uri: string): Buffer {
  const m = /^data:image\/png;base64,(.*)$/s.exec(uri);
  if (!m) throw new Error(`not a PNG data URI: ${uri.slice(0, 40)}…`);
  return Buffer.from(m[1], 'base64');
}

export function bufferToDataUri(buf: Uint8Array): string {
  return 'data:image/png;base64,' + Buffer.from(buf).toString('base64');
}
