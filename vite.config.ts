/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const providerDefines = Object.fromEntries(
    [...SHAREPOINT_ENV_KEYS, ...GITLAB_ENV_KEYS].map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] ?? '')])
  )
  return {
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
