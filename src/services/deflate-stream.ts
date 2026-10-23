/**
 * @file deflate-stream.ts
 * @brief The app's one async raw-DEFLATE codec (CompressionStream / DecompressionStream
 *        'deflate-raw', the same bitstream as pako.deflateRaw / draw.io's Graph.compress): share
 *        links, compressed `<diagram>` pages and PlantUML server URLs. Inflating always has an
 *        output cap (deflate bombs: a few KB can inflate to gigabytes). The synchronous inflater
 *        for stencils / library entries is src/drawio-shapes/engine/inflate.ts (same cap via codec.ts).
 */

/** Default cap of inflated data: real pages, even with embedded images, stay far below it. */
export const MAX_INFLATED_BYTES = 50 * 1024 * 1024;

export class InflateLimitError extends Error {
  constructor(readonly limit: number) {
    super(`Inflated data exceeds ${limit} bytes`);
    this.name = 'InflateLimitError';
  }
}

export class InflateDataError extends Error {
  constructor() {
    super('Corrupt or incomplete DEFLATE data');
    this.name = 'InflateDataError';
  }
}

export class NoCompressionStreamError extends Error {
  constructor(what: 'CompressionStream' | 'DecompressionStream') {
    super(`This browser has no ${what}`);
    this.name = 'NoCompressionStreamError';
  }
}

async function readAll(readable: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new InflateLimitError(limit);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function pipe(input: Uint8Array, stream: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> }, limit: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const write = (async () => {
    await writer.write(input as Uint8Array<ArrayBuffer>);
    await writer.close();
  })();
  // a failed write (corrupt input) also errors the readable side; read() reports it
  write.catch(() => undefined);
  const [, out] = await Promise.all([write, readAll(stream.readable, limit)]);
  return out;
}

/** Raw DEFLATE (no zlib header). */
export async function deflateRawBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new NoCompressionStreamError('CompressionStream');
  return pipe(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER);
}

/** Raw INFLATE with an output cap; throws InflateLimitError / InflateDataError. */
export async function inflateRawBytes(bytes: Uint8Array, limit = MAX_INFLATED_BYTES): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new NoCompressionStreamError('DecompressionStream');
  try {
    return await pipe(bytes, new DecompressionStream('deflate-raw'), limit);
  } catch (error) {
    if (error instanceof InflateLimitError) throw error;
    throw new InflateDataError();
  }
}
