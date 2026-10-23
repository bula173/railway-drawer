/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { htaccessFor, lanHeaders, siteHeaders } from './src/config/security-headers'

// Get git commit hash for build ID
let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Could not get git commit hash for build ID')
}

// Get build timestamp
const buildTime = new Date().toISOString()

// App version (status bar, Help > About): package.json is the one source
const appVersion = String(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version ?? '')

// SharePoint / OneDrive (docs/SHAREPOINT.md): from .env.local or the build environment (Cloudflare
// Workers Builds variables). Always defined (empty when unset), so `if (!import.meta.env.VITE_MSAL_CLIENT_ID)`
// is a constant and the MSAL chunk is not even built for unconfigured deployments.
const SHAREPOINT_ENV_KEYS = ['VITE_MSAL_CLIENT_ID', 'VITE_MSAL_TENANT_ID', 'VITE_SHAREPOINT_DEFAULT_SITE'] as const
// GitLab (docs/GITLAB.md): build-time defaults; the URL and application id can also be set at
// runtime in the Share dialog, so the GitLab chunk is always built (and only loaded when used).
const GITLAB_ENV_KEYS = ['VITE_GITLAB_URL', 'VITE_GITLAB_CLIENT_ID', 'VITE_GITLAB_DEFAULT_PROJECT'] as const

// Security headers (CSP etc.): public/_headers is the one source (Cloudflare applies it). The dev and
// preview servers send the same headers, so the app is developed and e2e-tested under the production
// CSP (RD_NO_CSP=1 turns that off for debugging); the build writes dist/.htaccess for the LAN Apache.
// Dev / preview only: the CSP also reports violations to /__rd-csp-report; GET /__rd-csp-reports lists
// them (the Playwright global teardown fails the run when any was reported). The dev server enforces
// the policy plus 'unsafe-eval' (the e2e harness runs `new Function` in the page) and sends the exact
// production policy as Report-Only, so an eval in APP code (a report with a source-file) still fails.
const CSP_REPORT_PATH = '/__rd-csp-report'
const CSP_REPORTS_PATH = '/__rd-csp-reports'
type Middleware = (
  req: { url?: string; method?: string; on(event: string, fn: (chunk?: unknown) => void): void },
  res: { setHeader(n: string, v: string): void; statusCode: number; end(body?: string): void },
  next: () => void
) => void
function securityHeaders(): Plugin {
  const headers = (): Array<[string, string]> => siteHeaders(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'))
  const reports: unknown[] = []
  const apply = (dev: boolean) => (server: { middlewares: { use(fn: Middleware): void } }): void => {
    if (process.env.RD_NO_CSP === '1') return
    const list: Array<[string, string]> = []
    for (const [name, value] of headers()) {
      if (name.toLowerCase() !== 'content-security-policy') {
        list.push([name, value])
        continue
      }
      const report = `report-uri ${CSP_REPORT_PATH}`
      if (dev) {
        list.push([name, `${value.replace(/script-src 'self'/, "script-src 'self' 'unsafe-eval'")}; ${report}`])
        list.push(['Content-Security-Policy-Report-Only', `${value}; ${report}`])
      } else {
        list.push([name, `${value}; ${report}`])
      }
    }
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? '').split('?')[0]
      if (path === CSP_REPORT_PATH && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += String(chunk)))
        req.on('end', () => {
          try {
            const report = JSON.parse(body) as unknown
            reports.push(report)
            console.warn('[csp] violation', JSON.stringify(report))
          } catch {
            // not JSON: ignored
          }
          res.statusCode = 204
          res.end()
        })
        return
      }
      if (path === CSP_REPORTS_PATH) {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(reports))
        return
      }
      for (const [name, value] of list) res.setHeader(name, value)
      next()
    })
  }
  return {
    name: 'rd-security-headers',
    configureServer: apply(true),
    configurePreviewServer: apply(false),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '.htaccess', source: htaccessFor(lanHeaders(headers())) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const providerDefines = Object.fromEntries(
    [...SHAREPOINT_ENV_KEYS, ...GITLAB_ENV_KEYS].map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] ?? '')])
  )
  return {
  plugins: [securityHeaders()],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    ...providerDefines,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  assetsInclude: ['**/*.xml'],
  server: {
    port: 3000,
    host: true,
  },
  build: {
        outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // maxGraph in its own file (its size shows whether tree shaking works)
            if (id.includes('/node_modules/@maxgraph/core/')) return 'maxgraph'
            // draw.io's JavaScript shapes (src/drawio-shapes/js, self-contained: only @maxgraph/core):
            // a separate chunk the entry preloads in parallel with main-editor (modulepreload)
            if (id.includes('/src/drawio-shapes/js/')) return 'drawio-shapes'
            return undefined
          },
        },
      },
      // The two big startup chunks cannot be split further cheaply: @maxgraph/core is one library
      // (~542 kB minified, ~144 kB gzip, no deep imports in 0.10) and main-editor is the editor itself
      // (~700 kB / ~219 kB gzip: every per-tab controller is built for the first tab; it was ~941 kB
      // before draw.io's JS shapes got their own chunk). Rarely used features are lazy chunks
      // (CLAUDE.md "Boot"). 800 kB leaves room for growth while a chunk beyond it still warns.
      chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Playwright specs (tests/e2e) run with `npm run test:e2e`, never under vitest
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/*.spec.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    // Node >= 25 enables Web Storage by default and its global localStorage
    // (undefined without --localstorage-file) shadows jsdom's implementation.
    execArgv: ['--no-experimental-webstorage'],
    server: {
      deps: {
        // @maxgraph/core 0.10 ships ESM with extensionless relative imports that
        // Node's resolver rejects; let Vite transform it instead of externalizing.
        inline: ['@maxgraph/core'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/main.ts', 'src/main-editor.ts', 'src/**/__tests__/**'],
    },
  },
}
})
