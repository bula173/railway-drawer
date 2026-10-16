/**
 * Self-hosted draw.io: downloads the official draw.war of the pinned draw.io release (the same tag as
 * the palette/stencil data, see scripts/drawio-palettes/fetch-sources.ts), checks its SHA-256, and
 * extracts a trimmed, offline-configured copy of the web app into a local cache ("site" dir).
 * The Vite plugin (./vite-plugin.ts) serves that dir at <base>drawio/ in dev and copies it to
 * dist/drawio/ on build. Nothing of it is committed.
 *
 * Usage: node scripts/drawio-selfhost/fetch-drawio.ts [--force] [--print-stats]
 *   (Node >= 22.18 strips TypeScript types natively.)
 *
 * Environment:
 *   DRAWIO_SELFHOST_CACHE_DIR  cache dir (default ~/.cache/railway-drawer/drawio-<tag>)
 *   DRAWIO_WAR                 path of an already downloaded draw.war (still SHA-256 checked; offline installs)
 *
 * draw.io is Apache-2.0, Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';
import { DRAWIO_TAG } from '../drawio-palettes/fetch-sources.ts';

export { DRAWIO_TAG };
export const WAR_URL = `https://github.com/jgraph/drawio/releases/download/${DRAWIO_TAG}/draw.war`;
/** SHA-256 of draw.war at the pinned tag (also published as the GitHub release asset digest). */
export const WAR_SHA256 = 'b83663313ccdecef6581476a7eaa96750bccf1bfdc3768981eb5d95e94be7820';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(HERE, 'config');
/** Bump when the trim rules or the extraction change (the config files are hashed automatically). */
const STAGE_FORMAT = 1;

export const CACHE_DIR = process.env.DRAWIO_SELFHOST_CACHE_DIR
  ? path.resolve(process.env.DRAWIO_SELFHOST_CACHE_DIR)
  : path.join(os.homedir() || os.tmpdir(), '.cache', 'railway-drawer', `drawio-${DRAWIO_TAG}`);
export const WAR_PATH = path.join(CACHE_DIR, 'draw.war');
export const SITE_DIR = path.join(CACHE_DIR, 'site');
const STAMP_FILE = '.rd-selfhost.json';

/** Cloudflare Workers static assets: max files per deployment (free plan) and bytes per file. */
export const CF_MAX_FILES = 20000;
export const CF_MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Files of the war that are NOT copied: the Java servlet part (WEB-INF holds placeholder OAuth
 * secrets), source maps, unminified dev sources (only loaded with ?dev=1), the cloud/Atlassian/Teams
 * integrations, the service worker (disabled with pwa=0) and clear.html (it would clear the
 * localStorage of the whole origin, i.e. also the app's data: same-origin iframe).
 */
const EXCLUDE_PREFIXES = [
  'META-INF/',
  'WEB-INF/',
  'connect/',
  'js/diagramly/',
  'js/grapheditor/',
  'js/desktop/',
  'js/onedrive/',
  'js/dropbox/',
  'mxgraph/src/',
];
const EXCLUDE_FILES = new Set([
  'js/integrate.min.js', // Atlassian Confluence/Jira integration (19 MB)
  'js/viewer.min.js', // the HTML export uses viewer-static.min.js
  'js/embed.dev.js',
  'js/clear.js',
  'clear.html',
  'service-worker.js',
  'dropbox.html',
  'github.html',
  'gitlab.html',
  'onedrive3.html',
  'teams.html',
  'monday-app-association.json',
  // replaced by config/PreConfig.js and config/PostConfig.js
  'js/PreConfig.js',
  'js/PostConfig.js',
]);

export function isIncluded(name: string): boolean {
  if (name.endsWith('/')) return false;
  if (name.endsWith('.map')) return false;
  if (/^workbox-[^/]*\.js$/.test(name)) return false;
  if (EXCLUDE_FILES.has(name)) return false;
  return !EXCLUDE_PREFIXES.some((p) => name.startsWith(p));
}

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function configFiles(): Array<{ rel: string; data: Buffer }> {
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => ({ rel: `js/${f}`, data: fs.readFileSync(path.join(CONFIG_DIR, f)) }));
}

function stageKey(): string {
  const h = createHash('sha256');
  h.update(`${STAGE_FORMAT}\0${DRAWIO_TAG}\0${WAR_SHA256}\0`);
  h.update(fs.readFileSync(fileURLToPath(import.meta.url)));
  for (const f of configFiles()) h.update(`\0${f.rel}\0`).update(f.data);
  return h.digest('hex');
}

// ---- minimal ZIP reader (stored + deflate; draw.war is a plain zip, no zip64) ----

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  crc: number;
  localOffset: number;
}

function readCentralDirectory(zip: Buffer): ZipEntry[] {
  const min = Math.max(0, zip.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = zip.length - 22; i >= min; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('draw.war: end of central directory not found');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error(`draw.war: bad central directory entry ${i}`);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    entries.push({
      method: zip.readUInt16LE(p + 10),
      crc: zip.readUInt32LE(p + 16),
      compressedSize: zip.readUInt32LE(p + 20),
      size: zip.readUInt32LE(p + 24),
      localOffset: zip.readUInt32LE(p + 42),
      name: zip.toString('utf8', p + 46, p + 46 + nameLen),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(zip: Buffer, e: ZipEntry): Buffer {
  const p = e.localOffset;
  if (zip.readUInt32LE(p) !== 0x04034b50) throw new Error(`draw.war: bad local header for ${e.name}`);
  const start = p + 30 + zip.readUInt16LE(p + 26) + zip.readUInt16LE(p + 28);
  const raw = zip.subarray(start, start + e.compressedSize);
  let data: Buffer;
  if (e.method === 0) data = Buffer.from(raw);
  else if (e.method === 8) data = zlib.inflateRawSync(raw);
  else throw new Error(`draw.war: unsupported compression ${e.method} for ${e.name}`);
  if (data.length !== e.size) throw new Error(`draw.war: size mismatch for ${e.name}`);
  const crc32 = (zlib as unknown as { crc32?: (b: Buffer) => number }).crc32;
  if (crc32 && crc32(data) >>> 0 !== e.crc >>> 0) throw new Error(`draw.war: CRC mismatch for ${e.name}`);
  return data;
}

function safeRelative(name: string): string {
  const norm = path.posix.normalize(name);
  if (norm.startsWith('../') || norm === '..' || path.posix.isAbsolute(norm) || norm.includes('\\')) {
    throw new Error(`draw.war: unsafe entry name ${name}`);
  }
  return norm;
}

// ---- download ----

async function obtainWar(force: boolean, log: (m: string) => void): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fromEnv = process.env.DRAWIO_WAR;
  if (fromEnv && (force || !fs.existsSync(WAR_PATH))) {
    fs.copyFileSync(path.resolve(fromEnv), WAR_PATH);
  }
  if (!force && fs.existsSync(WAR_PATH)) {
    const h = sha256(fs.readFileSync(WAR_PATH));
    if (h === WAR_SHA256) return;
    log(`cached draw.war has SHA-256 ${h}, expected ${WAR_SHA256}; downloading again`);
  }
  log(`downloading ${WAR_URL}`);
  const res = await fetch(WAR_URL);
  if (!res.ok) throw new Error(`GET ${WAR_URL} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const h = sha256(buf);
  if (h !== WAR_SHA256) throw new Error(`SHA-256 mismatch for draw.war: expected ${WAR_SHA256}, got ${h}`);
  const tmp = `${WAR_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, WAR_PATH);
  log(`draw.war ${DRAWIO_TAG} OK (${(buf.length / 1048576).toFixed(1)} MiB)`);
}

export interface SiteStats {
  files: number;
  bytes: number;
  largest: { name: string; bytes: number };
}

export interface EnsureResult {
  siteDir: string;
  stats: SiteStats;
  fresh: boolean;
}

function readStamp(): { key: string; stats: SiteStats } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(SITE_DIR, STAMP_FILE), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Returns the trimmed, configured draw.io web app dir; downloads and extracts it when the cache is
 * missing or stale (pinned tag, war hash, trim rules and config files form the cache key).
 */
export async function ensureDrawioSite(
  opts: { force?: boolean; log?: (m: string) => void } = {}
): Promise<EnsureResult> {
  const log = opts.log ?? ((m: string) => console.log(`[drawio-selfhost] ${m}`));
  const key = stageKey();
  const stamp = readStamp();
  if (!opts.force && stamp && stamp.key === key) {
    return { siteDir: SITE_DIR, stats: stamp.stats, fresh: false };
  }
  await obtainWar(!!opts.force, log);
  const zip = fs.readFileSync(WAR_PATH);
  const tmpDir = `${SITE_DIR}.${process.pid}.tmp`;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const stats: SiteStats = { files: 0, bytes: 0, largest: { name: '', bytes: 0 } };
  const write = (rel: string, data: Buffer) => {
    const dest = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    stats.files++;
    stats.bytes += data.length;
    if (data.length > stats.largest.bytes) stats.largest = { name: rel, bytes: data.length };
  };
  for (const e of readCentralDirectory(zip)) {
    const rel = safeRelative(e.name);
    if (!isIncluded(rel)) continue;
    write(rel, readEntry(zip, e));
  }
  for (const f of configFiles()) write(f.rel, f.data);
  if (stats.files > CF_MAX_FILES) throw new Error(`draw.io site has ${stats.files} files (> ${CF_MAX_FILES})`);
  if (stats.largest.bytes > CF_MAX_FILE_BYTES) {
    throw new Error(`draw.io site file ${stats.largest.name} is ${stats.largest.bytes} bytes (> 25 MiB)`);
  }
  fs.writeFileSync(path.join(tmpDir, STAMP_FILE), JSON.stringify({ key, tag: DRAWIO_TAG, stats }, null, 2) + '\n');
  fs.rmSync(SITE_DIR, { recursive: true, force: true });
  fs.renameSync(tmpDir, SITE_DIR);
  log(
    `draw.io ${DRAWIO_TAG} staged in ${SITE_DIR}: ${stats.files} files, ${(stats.bytes / 1048576).toFixed(1)} MiB ` +
      `(largest ${stats.largest.name} ${(stats.largest.bytes / 1048576).toFixed(1)} MiB)`
  );
  return { siteDir: SITE_DIR, stats, fresh: true };
}

/** Name of the stamp file inside the site dir (not copied/served). */
export const SITE_STAMP_FILE = STAMP_FILE;

const isMain = process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  ensureDrawioSite({ force: args.includes('--force') })
    .then((r) => {
      if (args.includes('--print-stats')) console.log(JSON.stringify(r, null, 2));
      else console.log(`[drawio-selfhost] ${r.siteDir} (${r.stats.files} files, ${(r.stats.bytes / 1048576).toFixed(1)} MiB)`);
    })
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
