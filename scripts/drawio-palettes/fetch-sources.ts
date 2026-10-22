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

/**
 * Commit the tag points to (annotated tag ea90828c… -> commit). Everything below is fetched by
 * commit, not by tag, and each file is checked against the git blob SHA-1 of that commit's tree,
 * so a moved tag or a corrupt download cannot change the generated data.
 */
export const DRAWIO_COMMIT = '9034053fba80a435e27d68d374bc564b83917ae9';
export const DRAWIO_TREE = '033aec3d561f0a4c099ae3dda9317090cf5a8d6a';
export const COMMIT_RAW_BASE = `https://raw.githubusercontent.com/jgraph/drawio/${DRAWIO_COMMIT}/`;
export const TREE_API_URL = `https://api.github.com/repos/jgraph/drawio/git/trees/${DRAWIO_COMMIT}?recursive=1`;

/**
 * Directories fetched in full (every file listed in the commit's tree, markdown skipped):
 * all sidebar palettes, all JS shape libraries, all palette images (img/lib, clipart, ...).
 */
export const SOURCE_DIRS = [
  WEBAPP + 'js/diagramly/sidebar/',
  WEBAPP + 'shapes/',
  WEBAPP + 'img/',
] as const;

/** Single files fetched by commit in addition to SOURCE_FILES. */
export const COMMIT_FILES = [
  // mxStencilRegistry.libraries (basename -> stencil XML / shape JS files)
  WEBAPP + 'js/diagramly/Editor.js',
  // MoreShapesDialog: the "More shapes" categories and library titles
  WEBAPP + 'js/diagramly/Dialogs.js',
  // English UI strings (mxResources.get) used for palette titles
  WEBAPP + 'resources/dia.txt',
  WEBAPP + 'templates/LICENSE',
  // constants and helpers the vendored shape libraries use (values / reference for the shim)
  WEBAPP + 'mxgraph/src/util/mxConstants.js',
  WEBAPP + 'mxgraph/src/util/mxUtils.js',
  WEBAPP + 'js/grapheditor/Graph.js',
] as const;

export function sourceUrl(repoPath: string): string {
  return RAW_BASE + repoPath;
}

interface TreeEntry { path: string; type: string; sha: string; size?: number }

/** git blob id: sha1("blob <len>\0" + content). */
function gitBlobSha(buf: Buffer): string {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

/** Loads (and caches) the recursive git tree of DRAWIO_COMMIT. */
async function loadTree(force: boolean): Promise<TreeEntry[]> {
  const dest = path.join(CACHE_DIR, `tree-${DRAWIO_COMMIT}.json`);
  let json: { sha?: string; truncated?: boolean; tree: TreeEntry[] };
  if (!force && fs.existsSync(dest)) {
    json = JSON.parse(fs.readFileSync(dest, 'utf8'));
  } else {
    const res = await fetch(TREE_API_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GET ${TREE_API_URL} -> HTTP ${res.status}`);
    json = await res.json() as typeof json;
    fs.writeFileSync(dest, JSON.stringify(json));
  }
  if (json.truncated) throw new Error('git tree listing is truncated');
  if (json.sha !== DRAWIO_TREE && json.sha !== DRAWIO_COMMIT) {
    throw new Error(`unexpected tree ${json.sha} for commit ${DRAWIO_COMMIT}`);
  }
  return json.tree;
}

/** Repo paths (+ blob ids) of every file under SOURCE_DIRS plus COMMIT_FILES. */
export function selectTreeFiles(tree: readonly TreeEntry[]): TreeEntry[] {
  return tree.filter((e) => e.type === 'blob' && !/\.md$/i.test(e.path) &&
    (SOURCE_DIRS.some((d) => e.path.startsWith(d)) || (COMMIT_FILES as readonly string[]).includes(e.path)));
}

/** Lists the cached repo paths under a directory prefix (after fetchTreeSources). */
export function listSources(prefix: string): string[] {
  const manifest = path.join(CACHE_DIR, 'tree-files.json');
  if (!fs.existsSync(manifest)) throw new Error(`Missing ${manifest}. Run: node scripts/drawio-palettes/fetch-sources.ts`);
  const files = JSON.parse(fs.readFileSync(manifest, 'utf8')) as string[];
  return files.filter((f) => f.startsWith(prefix));
}

/** Downloads SOURCE_DIRS + COMMIT_FILES by commit (cached), verifying each git blob id. */
export async function fetchTreeSources(opts: { force?: boolean } = {}): Promise<void> {
  const tree = await loadTree(!!opts.force);
  const files = selectTreeFiles(tree);
  for (const f of COMMIT_FILES) if (!files.some((e) => e.path === f)) throw new Error(`${f} not in tree`);
  let fetched = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const e = files[next++];
      const dest = cachePath(e.path);
      let buf: Buffer | null = null;
      if (!opts.force && fs.existsSync(dest)) {
        buf = fs.readFileSync(dest);
        if (gitBlobSha(buf) !== e.sha) buf = null;
      }
      if (buf == null) {
        const url = COMMIT_RAW_BASE + e.path.split('/').map(encodeURIComponent).join('/');
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 4 && buf == null; attempt++) {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
            buf = Buffer.from(await res.arrayBuffer());
          } catch (err) { lastErr = err; }
        }
        if (buf == null) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
        if (gitBlobSha(buf) !== e.sha) throw new Error(`git blob mismatch for ${e.path}`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        fetched++;
      }
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
  fs.writeFileSync(path.join(CACHE_DIR, 'tree-files.json'), JSON.stringify(files.map((e) => e.path).sort()));
  console.log(`draw.io ${DRAWIO_TAG} (${DRAWIO_COMMIT.slice(0, 10)}): ${files.length} tree files OK (${fetched} downloaded)`);
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
    .then(() => fetchTreeSources({ force: args.includes('--force') }))
    .then(() => copyLicenses())
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
