/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import { execSync } from 'child_process'
// Self-hosted draw.io at <base>drawio/ (dev server + dist/drawio/), see scripts/drawio-selfhost/
import { drawioSelfHost } from './scripts/drawio-selfhost/vite-plugin.ts'

// Get git commit hash for build ID
let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Could not get git commit hash for build ID')
}

// Get build timestamp
const buildTime = new Date().toISOString()

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
  plugins: [drawioSelfHost()],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
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
          manualChunks: {
            // put the maxgraph code in a dedicated file. It lets know the size the produced bundle in an external application and if tree shaking works
            maxgraph: ['@maxgraph/core'],
          },
        },
      },
      chunkSizeWarningLimit: 367, // @maxgraph/core
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/e2e/parity/__tests__/**/*.test.ts'],
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
      exclude: ['src/**/*.d.ts', 'src/main.ts', 'src/legacy-main.ts', 'src/**/__tests__/**'],
    },
  },
}
})
