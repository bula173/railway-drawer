/**
 * Downloads the draw.io (jgraph/drawio) sources needed to build the palette data
 * and the vendored stencil XML into a local cache, pinned to one release tag.
 *
 * Usage: node scripts/drawio-palettes/fetch-sources.ts [--force]
 *   (Node >= 22.18 strips TypeScript types natively; `npx tsx` works as well.)
 *
 * Cache: $DRAWIO_CACHE_DIR or <os.tmpdir()>/drawio-v32.4.1 (outside the repo, because
 * `.cache/` is not git-ignored in this repository). Files keep their upstream repo path.
 *
 * draw.io is Apache-2.0, Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DRAWIO_TAG = 'v32.4.1';
export const DRAWIO_VERSION = DRAWIO_TAG.slice(1);
export const RAW_BASE = `https://raw.githubusercontent.com/jgraph/drawio/${DRAWIO_TAG}/`;
export const WEBAPP = 'src/main/webapp/';

export const CACHE_DIR = process.env.DRAWIO_CACHE_DIR
  ? path.resolve(process.env.DRAWIO_CACHE_DIR)
  : path.join(os.tmpdir(), `drawio-${DRAWIO_TAG}`);

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Repo-relative paths (from the drawio repo root) of every file the scripts read. */
export const SOURCE_FILES = [
  'VERSION',
  'LICENSE',
  WEBAPP + 'stencils/LICENSE',
  WEBAPP + 'js/stencils.min.js',
  WEBAPP + 'js/grapheditor/Sidebar.js',
  WEBAPP + 'js/grapheditor/Shapes.js',
  WEBAPP + 'js/diagramly/sidebar/Sidebar.js',
  WEBAPP + 'js/diagramly/sidebar/Sidebar-Basic.js',
  WEBAPP + 'js/diagramly/sidebar/Sidebar-Arrows2.js',
  WEBAPP + 'js/diagramly/sidebar/Sidebar-Flowchart.js',
  WEBAPP + 'shapes/mxBasic.js',
  WEBAPP + 'shapes/mxArrows.js',
  WEBAPP + 'shapes/mxFlowchart.js',
] as const;

/** SHA-256 of each file at the pinned tag (guards against a moved tag or a corrupt cache). */
export const SHA256: Record<string, string> = {
  // regenerate with `node scripts/drawio-palettes/fetch-sources.ts --force --print-hashes` when bumping the tag
  'VERSION': 'e23ad99aa478ba3b159e9ceddc053aa51d638eecff3dd7b2e782eff12cf6fe95',
  'LICENSE': '43070e2d4e532684de521b885f385d0841030efa2b1a20bafb76133a5e1379c1',
  'src/main/webapp/stencils/LICENSE': 'f4098ff053b5954abbf69b15811ef06cd277847ca49934beda355c3d841ebdac',
  'src/main/webapp/js/stencils.min.js': 'f6ee4f7244ed74ba74b012ee621bc8d14f8492583a976e37f2b75328145c29b6',
  'src/main/webapp/js/grapheditor/Sidebar.js': 'dffe26d7d911fe83a14951a81854072b78a54871d979e9c3704b6b8daee63175',
  'src/main/webapp/js/grapheditor/Shapes.js': '5d8b1e2b0b1ccb228554f2bd8f0ddf8dd6202c093e9b40c1ff38448ce41f1870',
  'src/main/webapp/js/diagramly/sidebar/Sidebar.js': 'a2fed0cfa502e6571ac68d5972634f17f1caa252f6c1f61d1b95397db9170b00',
  'src/main/webapp/js/diagramly/sidebar/Sidebar-Basic.js': 'da5bf8832755f508ab0b37264721bcdbe31d4e2b9f435cf0d55bc470c27778cb',
  'src/main/webapp/js/diagramly/sidebar/Sidebar-Arrows2.js': '044358b777660c7174d9c6fb8f1eebc45bf23d60c78625c5dc704019504278bd',
  'src/main/webapp/js/diagramly/sidebar/Sidebar-Flowchart.js': '35a358a702fdbcda74adc0a830e357049355594064c01c9620123ce86762f865',
  'src/main/webapp/shapes/mxBasic.js': '5488fe50e2e6b6d70802f50d01fe8a216b7e8f548ce1b358f258152de5e6b65a',
  'src/main/webapp/shapes/mxArrows.js': '83755ab9268075c0b3578a9e543b4cf28dd2a30fb22474c3b31fa71a84151325',
  'src/main/webapp/shapes/mxFlowchart.js': 'd427b1de3d5ea968d06c7bbbc20decb429d69269ed09574819eb90d4ade3d3b5',
};

export function sourceUrl(repoPath: string): string {
  return RAW_BASE + repoPath;
}

export function cachePath(repoPath: string): string {
  return path.join(CACHE_DIR, repoPath);
}

export function readSource(repoPath: string): string {
  const p = cachePath(repoPath);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${p}. Run: node scripts/drawio-palettes/fetch-sources.ts`);
  }
  return fs.readFileSync(p, 'utf8');
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export async function fetchSources(opts: { force?: boolean; printHashes?: boolean } = {}): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const repoPath of SOURCE_FILES) {
    const dest = cachePath(repoPath);
    let buf: Buffer;
    if (!opts.force && fs.existsSync(dest)) {
      buf = fs.readFileSync(dest);
    } else {
      const url = sourceUrl(repoPath);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      console.log(`fetched ${repoPath} (${buf.length} bytes)`);
    }
    const h = sha256(buf);
    hashes[repoPath] = h;
    const expected = SHA256[repoPath];
    if (expected && expected !== h) {
      throw new Error(`SHA-256 mismatch for ${repoPath}: expected ${expected}, got ${h} (cache ${dest}; retry with --force)`);
    }
  }
  const version = fs.readFileSync(cachePath('VERSION'), 'utf8').trim();
  if (version !== DRAWIO_VERSION) {
    throw new Error(`VERSION at ${DRAWIO_TAG} is "${version}", expected "${DRAWIO_VERSION}"`);
  }
  fs.writeFileSync(path.join(CACHE_DIR, 'manifest.json'),
    JSON.stringify({ drawioTag: DRAWIO_TAG, base: RAW_BASE, sha256: hashes }, null, 2) + '\n');
  if (opts.printHashes) console.log(JSON.stringify(hashes, null, 2));
  console.log(`draw.io ${DRAWIO_TAG} sources OK in ${CACHE_DIR}`);
}

/** Copies the license files into the repo (third_party/drawio/LICENSE, public/stencils/LICENSE). */
export function copyLicenses(): void {
  const pairs: Array<[string, string]> = [
    ['LICENSE', 'third_party/drawio/LICENSE'],
    [WEBAPP + 'stencils/LICENSE', 'public/stencils/LICENSE'],
  ];
  for (const [from, to] of pairs) {
    const dest = path.join(REPO_ROOT, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(cachePath(from), dest);
    console.log(`wrote ${to}`);
  }
}

const isMain = process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  fetchSources({ force: args.includes('--force'), printHashes: args.includes('--print-hashes') })
    .then(() => copyLicenses())
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
