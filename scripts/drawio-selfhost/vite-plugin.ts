/**
 * Vite plugin: self-hosted draw.io at <base>drawio/ (see ./fetch-drawio.ts).
 * - dev server (`npm run dev`, Playwright's webServer): serves the cached site dir as static files
 *   (registered before Vite's own middlewares, so draw.io's HTML is never transformed);
 * - build (`npm run build`, Cloudflare Workers Builds, deploy.sh): copies it to <outDir>/drawio/.
 * The site is fetched/staged once (cached, SHA-256 checked) when the config is resolved.
 *
 * DRAWIO_SELFHOST=0 disables the plugin (the app then needs VITE_DRAWIO_URL, e.g. embed.diagrams.net).
 * Under vitest the plugin does nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { ensureDrawioSite, SITE_STAMP_FILE } from './fetch-drawio.ts';

export const DRAWIO_MOUNT = 'drawio';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json',
};

export function drawioSelfHost(): Plugin {
  let siteDir: string | null = null;
  let config: ResolvedConfig;
  const enabled = process.env.DRAWIO_SELFHOST !== '0' && !process.env.VITEST;

  return {
    name: 'railway-drawer:drawio-selfhost',
    async configResolved(resolved) {
      config = resolved;
      if (!enabled) return;
      try {
        siteDir = (await ensureDrawioSite({ log: (m) => resolved.logger.info(`[drawio-selfhost] ${m}`) })).siteDir;
      } catch (error) {
        const message = `[drawio-selfhost] draw.io could not be prepared: ${(error as Error)?.message ?? error}`;
        // A build without draw.io would deploy a broken draw.io mode; the dev server keeps running.
        if (resolved.command === 'build') {
          throw new Error(`${message} (set DRAWIO_SELFHOST=0 and VITE_DRAWIO_URL to build without it)`);
        }
        resolved.logger.warn(`${message}; draw.io mode will show "not reachable"`);
      }
    },
    configureServer(server) {
      if (!enabled) return;
      const base = server.config.base.startsWith('/') ? server.config.base : '/';
      const prefix = `${base}${DRAWIO_MOUNT}/`;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const pathname = url.split('?')[0].split('#')[0];
        if (pathname === `${base}${DRAWIO_MOUNT}`) {
          res.statusCode = 301;
          res.setHeader('Location', prefix + url.slice(pathname.length));
          res.end();
          return;
        }
        if (!pathname.startsWith(prefix)) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let rel: string;
        try {
          rel = decodeURIComponent(pathname.slice(prefix.length));
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        if (rel === '' || rel.endsWith('/')) rel += 'index.html';
        const root = siteDir;
        const file = root ? path.resolve(root, rel) : '';
        if (!root || !file.startsWith(root + path.sep) || rel === SITE_STAMP_FILE || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(root ? 'Not found' : 'draw.io is not available (see the dev server log: drawio-selfhost)');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(fs.statSync(file).size));
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      if (!enabled || !siteDir || config.command !== 'build') return;
      const dest = path.resolve(config.root, config.build.outDir, DRAWIO_MOUNT);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(siteDir, dest, { recursive: true, filter: (src) => path.basename(src) !== SITE_STAMP_FILE });
      config.logger.info(`[drawio-selfhost] copied draw.io to ${path.relative(config.root, dest)}/`);
    },
  };
}
