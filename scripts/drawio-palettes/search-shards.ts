/**
 * Writes the all-libraries search index (`title\ttags` of every palette entry, per palette, in
 * catalogue order) as shards: src/drawio-shapes/palettes/data/search/search-index-NN.json, each
 * `{ drawioTag, palettes }` and at most ~SHARD_BYTES long. The app loads all shards on the first
 * search and concatenates them in file-name order (src/drawio-shapes/palettes/index.ts
 * loadPaletteSearchIndex), so the merged index is the former single search-index.json; small
 * shards keep every lazy chunk well below the build's chunk size warning.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const SEARCH_SHARD_DIR = 'search';
const SHARD_BYTES = 200_000;

export function writeSearchShards(dataDir: string, drawioTag: string, palettes: Array<[string, string[]]>): string[] {
  const dir = path.join(dataDir, SEARCH_SHARD_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/^search-index-\d+\.json$/.test(f)) fs.unlinkSync(path.join(dir, f));
  const shards: Array<Array<[string, string[]]>> = [[]];
  let size = 0;
  for (const p of palettes) {
    const bytes = JSON.stringify(p).length + 1;
    if (size > 0 && size + bytes > SHARD_BYTES) {
      shards.push([]);
      size = 0;
    }
    shards[shards.length - 1].push(p);
    size += bytes;
  }
  return shards.map((part, i) => {
    const name = `search-index-${String(i).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ drawioTag, palettes: part }) + '\n');
    return name;
  });
}

